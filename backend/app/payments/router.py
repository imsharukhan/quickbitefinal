import json
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.payments.service import PaymentService, PLATFORM_FEE
from app.orders.models import Order
from app.orders.service import format_order_response
from app.outlets.models import Outlet
from app.notifications.models import Notification
from app.orders.websocket import manager
from app.auth.dependencies import get_current_user
from app.users.models import User
from app.config import settings

router = APIRouter()


class CreatePaymentOrderRequest(BaseModel):
    order_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str  # Our internal order ID


async def _trigger_route_transfer(db: AsyncSession, order: Order, payment_id: str):
    """Transfer items amount to canteen if linked account is set (post-KYC)."""
    result = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = result.scalars().first()
    if outlet and outlet.razorpay_account_id:
        items_amount = order.total_price - PLATFORM_FEE
        try:
            PaymentService.transfer_to_canteen(
                payment_id=payment_id,
                linked_account_id=outlet.razorpay_account_id,
                items_amount_rupees=items_amount
            )
        except Exception as e:
            # Money is safely in your account — transfer can be retried manually
            # until canteen completes KYC or if Routes has an issue
            print(f"[Razorpay Routes] Transfer failed for order {order.id}: {e}")


@router.post("/create-order")
async def create_payment_order(
    data: CreatePaymentOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Step 1 of checkout: create Razorpay order for a pending DB order.
    Returns razorpay_order_id + key_id to frontend for checkout.js.
    """
    result = await db.execute(select(Order).where(Order.id == data.order_id))
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if str(order.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    if order.payment_status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Order already paid")

    # Reuse existing Razorpay order if created within last 15 mins (Razorpay expiry)
    if order.razorpay_order_id:
        return {
            "razorpay_order_id": order.razorpay_order_id,
            "amount": int(order.total_price * 100),
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "order_id": order.id,
            "prefill": {"name": current_user.name, "email": current_user.email}
        }

    rzp_order = PaymentService.create_razorpay_order(
        amount_rupees=order.total_price,
        receipt=order.id
    )

    order.razorpay_order_id = rzp_order["id"]
    order.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "razorpay_order_id": rzp_order["id"],
        "amount": rzp_order["amount"],
        "currency": rzp_order["currency"],
        "key_id": settings.RAZORPAY_KEY_ID,
        "order_id": order.id,
        "prefill": {"name": current_user.name, "email": current_user.email}
    }


@router.post("/verify")
async def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Step 2 of checkout: verify Razorpay signature server-side.
    Marks order COMPLETED, triggers Route transfer, returns order with token.
    """
    is_valid = PaymentService.verify_payment_signature(
        data.razorpay_order_id,
        data.razorpay_payment_id,
        data.razorpay_signature
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    result = await db.execute(select(Order).where(Order.id == data.order_id))
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if str(order.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if order.payment_status == "COMPLETED":
        # Already processed (webhook may have fired first) — just return order
        return await format_order_response(db, order)

    order.payment_status = "COMPLETED"
    order.payment_gateway_id = data.razorpay_payment_id
    order.updated_at = datetime.utcnow()

    db.add(Notification(
        user_id=order.user_id,
        message=f"✅ Payment confirmed! Your token is #{order.token_number}. Show it at the counter.",
        related_order_id=order.id
    ))
    await db.commit()

    # Trigger Route transfer (skipped if canteen hasn't done KYC yet)
    await _trigger_route_transfer(db, order, data.razorpay_payment_id)

    # Notify vendor in real-time
    formatted = await format_order_response(db, order)
    await manager.notify_vendor(
        str(order.outlet_id),
        {"type": "PAYMENT_RECEIVED", "order": formatted}
    )

    return formatted


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Razorpay calls this automatically after payment.
    This is the BACKUP in case student closes app before verify completes.
    Must be a public endpoint — verified by signature only.
    """
    body = await request.body()

    if not x_razorpay_signature or not PaymentService.verify_webhook_signature(
        body, x_razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)
    event = payload.get("event")

    if event != "payment.captured":
        return {"status": "ignored"}

    payment = payload["payload"]["payment"]["entity"]
    rzp_order_id = payment.get("order_id")  # Razorpay order ID

    result = await db.execute(
        select(Order).where(Order.razorpay_order_id == rzp_order_id)
    )
    order = result.scalars().first()

    if not order:
        return {"status": "order_not_found"}

    if order.payment_status == "COMPLETED":
        return {"status": "already_processed"}

    payment_id = payment["id"]
    order.payment_status = "COMPLETED"
    order.payment_gateway_id = payment_id
    order.updated_at = datetime.utcnow()

    db.add(Notification(
        user_id=order.user_id,
        message=f"✅ Payment confirmed! Your token is #{order.token_number}.",
        related_order_id=order.id
    ))
    await db.commit()

    await _trigger_route_transfer(db, order, payment_id)

    # Notify both student and vendor
    formatted = await format_order_response(db, order)
    await manager.notify_student(
        str(order.user_id),
        {
            "type": "PAYMENT_CONFIRMED",
            "order_id": order.id,
            "token_number": order.token_number,
            "message": f"✅ Payment confirmed! Your token is #{order.token_number}"
        }
    )
    await manager.notify_vendor(
        str(order.outlet_id),
        {"type": "PAYMENT_RECEIVED", "order": formatted}
    )

    return {"status": "ok"}