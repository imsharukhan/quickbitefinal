from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.orders import schemas, service
from app.auth.dependencies import get_current_user, get_current_vendor
from app.orders.websocket import manager
from app.auth.utils import decode_token
from app.users.models import User
import asyncio
import time

router = APIRouter()


async def notify_vendor_for_outlet(db: AsyncSession, outlet_id: str, payload: dict):
    from sqlalchemy.future import select
    from app.outlets.models import Outlet
    from app.vendors.models import Vendor

    outlet_res = await db.execute(select(Outlet).where(Outlet.id == outlet_id))
    outlet = outlet_res.scalars().first()
    if not outlet:
        return
    vendor_res = await db.execute(select(Vendor).where(Vendor.id == outlet.vendor_id))
    vendor = vendor_res.scalars().first()
    if vendor:
        await manager.notify_vendor(str(vendor.user_id), payload)

@router.post("", response_model=schemas.OrderResponse)
async def create_order(
    data: schemas.OrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    order = await service.create_order(db, str(current_user.id), data)
    formatted_order = await service.format_order_response(db, order)
    return formatted_order

@router.get("/my", response_model=list[schemas.OrderResponse])
async def get_my_orders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await service.get_orders_by_user(db, str(current_user.id))

@router.get("/outlet/{outlet_id}", response_model=list[schemas.OrderResponse])
async def get_outlet_orders(
    outlet_id: str,
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    from app.outlets.service import validate_vendor_owns_outlet
    owns = await validate_vendor_owns_outlet(db, str(current_vendor.id), outlet_id)
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return await service.get_orders_by_outlet(db, outlet_id, status, date)

@router.get("/{order_id}", response_model=schemas.OrderResponse)
async def get_order_by_id(
    order_id: str,
    db: AsyncSession = Depends(get_db)
):
    order = await service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.patch("/{order_id}/confirm-payment", response_model=schemas.OrderResponse)
async def confirm_payment(
    order_id: str,
    data: Optional[schemas.PaymentConfirm] = None,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    payment_gateway_id = data.payment_gateway_id if data else None
    order = await service.confirm_payment_and_prepare(
        db, order_id, str(current_vendor.id), payment_gateway_id
    )
    
    await manager.notify_student(
        str(order["user_id"]),
        {
            "type": "STATUS_UPDATE",
            "order_id": order_id,
            "status": "Preparing",
            "payment_status": "COMPLETED",
            "message": "Payment confirmed! Your food is being prepared 🍳"
        }
    )
    return order

@router.patch("/{order_id}/status", response_model=schemas.OrderResponse)
async def update_status(
    order_id: str,
    data: schemas.StatusUpdate,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    order = await service.update_order_status(
        db, order_id, data.status, str(current_vendor.id)
    )
    
    msg = ""
    if data.status == "Ready for Pickup":
        msg = f"Order #{order['token_number']} is ready! Come pick it up 🎉"
    elif data.status == "Picked Up":
        msg = f"Order #{order['token_number']} picked up! Enjoy your meal 😊 Rate us ⭐"
    else:
        msg = f"Order #{order['token_number']} status updated to {data.status}!"
    
    await manager.notify_student(
        str(order["user_id"]),
        {
            "type": "STATUS_UPDATE",
            "order_id": order_id,
            "status": data.status,
            "payment_status": order.get("payment_status", "COMPLETED"),
            "message": msg
        }
    )
    return order

@router.patch("/{order_id}/cancel", response_model=schemas.OrderResponse)
async def cancel_student(
    order_id: str,
    data: schemas.CancelOrder,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    order = await service.cancel_order_by_student(
        db, order_id, str(current_user.id), data.reason
    )
    
    await notify_vendor_for_outlet(db, str(order["outlet_id"]), {"type": "ORDER_CANCELLED", "order_id": order_id})
    return order

@router.patch("/{order_id}/cancel-vendor", response_model=schemas.OrderResponse)
async def cancel_vendor(
    order_id: str,
    data: schemas.CancelOrder,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    order = await service.cancel_order_by_vendor(
        db, order_id, str(current_vendor.id), data.reason
    )
    
    await manager.notify_student(
        str(order["user_id"]),
        {"type": "ORDER_CANCELLED", "order_id": order_id}
    )
    return order

@router.post("/{order_id}/rate")
async def submit_rating(
    order_id: str,
    data: schemas.RateOrder,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await service.submit_rating(
        db, order_id, str(current_user.id), data.stars, data.review
    )

@router.get("/outlet/{outlet_id}/stats")
async def get_outlet_stats(
    outlet_id: str,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    from app.outlets.service import validate_vendor_owns_outlet
    owns = await validate_vendor_owns_outlet(db, str(current_vendor.id), outlet_id)
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await service.get_outlet_stats(db, outlet_id)

@router.get("/outlet/{outlet_id}/history")
async def get_outlet_history(
    outlet_id: str,
    current_vendor = Depends(get_current_vendor),
    db: AsyncSession = Depends(get_db)
):
    from app.outlets.service import validate_vendor_owns_outlet
    owns = await validate_vendor_owns_outlet(db, str(current_vendor.id), outlet_id)
    if not owns:
        raise HTTPException(status_code=403, detail="Not authorized")
    return await service.get_outlet_history(db, outlet_id)    

@router.websocket("/ws/student/{user_id}")
async def student_websocket(websocket: WebSocket, user_id: str, token: str = Query(...)):
    try:
        payload = decode_token(token)
        if payload.get("role") not in ["student", "staff"] or payload.get("sub") != user_id:
            await websocket.accept()
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.accept()
        await websocket.close(code=4001)
        return

    await manager.connect_student(websocket, user_id)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
            
            exp = payload.get("exp", 0)
            if exp - time.time() < 300:
                await websocket.send_json({"type": "TOKEN_EXPIRING"})
    except WebSocketDisconnect:
        manager.disconnect_student(user_id)
    except Exception:
        manager.disconnect_student(user_id)

@router.websocket("/ws/vendor/{vendor_id}")
async def vendor_websocket(websocket: WebSocket, vendor_id: str, token: str = Query(...)):
    try:
        payload = decode_token(token)
        if payload.get("role") != "vendor" or payload.get("sub") != vendor_id:
            await websocket.accept()
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.accept()
        await websocket.close(code=4001)
        return

    await manager.connect_vendor(websocket, vendor_id)
    try:
        while True:
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect_vendor(websocket, vendor_id)
    except Exception:
        manager.disconnect_vendor(websocket, vendor_id)
