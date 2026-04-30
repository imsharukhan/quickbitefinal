import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.auth.dependencies import get_current_user
from app.config import settings
from app.database import get_db
from app.notifications.models import Notification
from app.orders.models import Order, OrderItem
from app.orders.service import format_order_response, get_daily_token
from app.orders.websocket import manager
from app.outlets.models import Outlet
from app.payments.service import PaymentService
from app.users.models import User
from app.vendors.models import Vendor

router = APIRouter()


class CreatePaymentOrderRequest(BaseModel):
    order_id: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    order_id: str


async def _trigger_route_transfer(db: AsyncSession, order: Order, payment_id: str):
    result = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = result.scalars().first()
    if not outlet or not outlet.razorpay_account_id:
        return

    items_result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    order_items = items_result.scalars().all()
    items_amount = sum(float(item.price) * item.quantity for item in order_items)
    vendor_amount = min(items_amount, max(float(order.total_price) - float(order.platform_fee or 0), 0))

    try:
        PaymentService.transfer_to_canteen(
            payment_id=payment_id,
            linked_account_id=outlet.razorpay_account_id,
            vendor_amount_rupees=vendor_amount
        )
    except Exception as exc:
        print(f"[Razorpay Routes] Transfer failed for order {order.id}: {exc}")


async def _notify_vendor_for_order(db: AsyncSession, order: Order, payload: dict):
    outlet_res = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = outlet_res.scalars().first()
    if not outlet:
        return
    vendor_res = await db.execute(select(Vendor).where(Vendor.id == outlet.vendor_id))
    vendor = vendor_res.scalars().first()
    if vendor:
        await manager.notify_vendor(str(vendor.user_id), payload)


async def _mark_order_paid(db: AsyncSession, order: Order, payment_id: str) -> dict:
    order.payment_status = "COMPLETED"
    order.payment_gateway_id = payment_id
    order.updated_at = datetime.utcnow()
    if order.token_number is None:
        order.token_number = await get_daily_token(db, str(order.outlet_id))

    outlet_res = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = outlet_res.scalars().first()
    outlet_name = outlet.name if outlet else "canteen"

    db.add(Notification(
        user_id=order.user_id,
        message=f"Payment confirmed! Your token #{order.token_number} at {outlet_name}. Show it at the counter to collect your order.",
        related_order_id=order.id
    ))
    await db.commit()

    await _trigger_route_transfer(db, order, payment_id)
    formatted = await format_order_response(db, order)
    await _notify_vendor_for_order(db, order, {"type": "NEW_ORDER", "order": formatted})
    return formatted


@router.post("/create-order")
async def create_payment_order(
    data: CreatePaymentOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Order).where(Order.id == data.order_id))
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if str(order.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    if order.payment_status == "COMPLETED":
        raise HTTPException(status_code=400, detail="Order already paid")

    if order.razorpay_order_id:
        return {
            "razorpay_order_id": order.razorpay_order_id,
            "amount": int(round(order.total_price * 100)),
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "order_id": order.id,
            "prefill": {
                "name": current_user.student_profile.name if current_user.student_profile else "",
                "email": current_user.email or ""
            }
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
        "prefill": {
            "name": current_user.student_profile.name if current_user.student_profile else "",
            "email": current_user.email or ""
        }
    }


@router.post("/verify")
async def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not PaymentService.verify_payment_signature(
        data.razorpay_order_id,
        data.razorpay_payment_id,
        data.razorpay_signature
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    result = await db.execute(select(Order).where(Order.id == data.order_id).with_for_update())
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if str(order.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    if order.razorpay_order_id != data.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Payment order mismatch")

    if order.payment_status == "COMPLETED":
        return await format_order_response(db, order)

    return await _mark_order_paid(db, order, data.razorpay_payment_id)


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    body = await request.body()

    if not x_razorpay_signature or not PaymentService.verify_webhook_signature(body, x_razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)
    if payload.get("event") != "payment.captured":
        return {"status": "ignored"}

    payment = payload["payload"]["payment"]["entity"]
    rzp_order_id = payment.get("order_id")

    result = await db.execute(select(Order).where(Order.razorpay_order_id == rzp_order_id).with_for_update())
    order = result.scalars().first()

    if not order:
        return {"status": "order_not_found"}
    if order.payment_status == "COMPLETED":
        return {"status": "already_processed"}

    formatted = await _mark_order_paid(db, order, payment["id"])
    await manager.notify_student(
        str(order.user_id),
        {
            "type": "PAYMENT_CONFIRMED",
            "order_id": order.id,
            "token_number": order.token_number,
            "message": f"Payment confirmed! Your token is #{order.token_number}"
        }
    )

    return {"status": "ok", "order_id": formatted["id"]}
