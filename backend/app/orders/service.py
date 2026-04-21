from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from fastapi import HTTPException
from datetime import timedelta
from app.orders.models import Order, OrderItem, Rating
from app.outlets.models import Outlet
from app.menu.models import MenuItem
from app.users.models import User
from app.orders.schemas import OrderCreate
from app.redis_client import redis_client
from app.auth.utils import generate_order_id
from app.payments.service import PaymentService
from app.notifications.models import Notification
from datetime import datetime
from uuid import UUID
import pytz
import hashlib
import json

IST = pytz.timezone('Asia/Kolkata')

async def get_daily_token(db: AsyncSession, outlet_id: str) -> int:
    today_ist = datetime.now(IST).date()
    start_of_day = IST.localize(datetime(today_ist.year, today_ist.month, today_ist.day))
    start_of_day_utc = start_of_day.astimezone(pytz.UTC).replace(tzinfo=None)
    result = await db.execute(
        select(func.count(Order.id)).where(
            Order.outlet_id == outlet_id,
            Order.placed_at >= start_of_day_utc
        )
    )
    count = result.scalar()
    if count >= 20:
        raise HTTPException(
            status_code=400,
            detail="This canteen has reached its order limit for today (20 orders). Please try again tomorrow."
        )
    return count + 1

def generate_idempotency_key(user_id: str, outlet_id: str, pickup_time: str, items: list) -> str:
    sorted_items = sorted(items, key=lambda x: x.menu_item_id)
    data = f"{user_id}{outlet_id}{pickup_time}{json.dumps([i.model_dump() for i in sorted_items])}"
    return hashlib.md5(data.encode()).hexdigest()

def get_upi_deep_link(outlet: Outlet, order: Order) -> str:
    if not outlet.upi_id:
        return ""
    return f"upi://pay?pa={outlet.upi_id}&pn={outlet.name}&am={order.total_price}&cu=INR&tn=QuickBite {order.id} Token%23{order.token_number}"

async def create_order(db: AsyncSession, user_id: str, data: OrderCreate):
    key = generate_idempotency_key(user_id, data.outlet_id, data.pickup_time, data.items)
    existing_id = redis_client.get(f"idempotency:{key}")
    
    if existing_id:
        existing_id = str(existing_id)
        result = await db.execute(select(Order).where(Order.id == existing_id))
        order = result.scalars().first()
        if order:
            return order

    result = await db.execute(select(Outlet).where(Outlet.id == data.outlet_id))
    outlet = result.scalars().first()
    if not outlet or not outlet.is_open:
        raise HTTPException(status_code=400, detail="Outlet is currently closed")

    total_price = data.total_price
    order_items_to_create = []

    for item_input in data.items:
        result = await db.execute(select(MenuItem).where(MenuItem.id == item_input.menu_item_id))
        menu_item = result.scalars().first()
        if not menu_item:
            raise HTTPException(status_code=400, detail="Menu item not found")
        if str(menu_item.outlet_id) != str(data.outlet_id):
            raise HTTPException(status_code=400, detail="Item does not belong to this outlet")
        if not menu_item.is_available:
            raise HTTPException(status_code=400, detail=f"{menu_item.name} is currently unavailable")
            
        order_items_to_create.append(OrderItem(
            menu_item_id=menu_item.id,
            name=menu_item.name,
            price=menu_item.price,
            quantity=item_input.quantity,
            is_veg=menu_item.is_veg
        ))



    token_number = await get_daily_token(db, data.outlet_id)

    order_id = generate_order_id()
    now_utc = datetime.utcnow()
    
    order = Order(
        id=order_id,
        user_id=user_id,
        outlet_id=data.outlet_id,
        status="Placed",
        payment_status="PENDING",
        payment_confirmed_by_vendor=False,
        payment_gateway_id=None,
        total_price=total_price,
        pickup_time=data.pickup_time,
        token_number=token_number,
        payment_method="upi",
        placed_at=now_utc,
        updated_at=now_utc,
        idempotency_key=key
    )
    db.add(order)
    await db.flush()

    for oi in order_items_to_create:
        oi.order_id = order.id
        db.add(oi)

    notification = Notification(
        user_id=user_id,
        message=f"Order #{token_number} placed at {outlet.name}! Pay ₹{total_price} via UPI and show your token at the counter.",
        related_order_id=order.id
    )
    db.add(notification)
    
    await db.commit()
    await db.refresh(order)
    
    redis_client.set(f"idempotency:{key}", order.id, ex=30)
    return order

async def format_order_response(db: AsyncSession, order: Order) -> dict:
    result = await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))
    items = result.scalars().all()

    result = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = result.scalars().first()

    result = await db.execute(select(User).where(User.id == order.user_id))
    user = result.scalars().first()

    # ── Fetch student profile for name + register number ──────────────
    from app.users.models import Student
    student = None
    if user:
        result = await db.execute(select(Student).where(Student.user_id == user.id))
        student = result.scalars().first()
    # ──────────────────────────────────────────────────────────────────

    result = await db.execute(select(Rating).where(Rating.order_id == order.id))
    rating = result.scalars().first()

    # ── Token validity: only valid if placed today IST ─────────────────
    today_ist_date = datetime.now(IST).date()
    placed_naive = order.placed_at
    placed_utc = placed_naive.replace(tzinfo=pytz.UTC) if placed_naive.tzinfo is None else placed_naive
    placed_ist_date = placed_utc.astimezone(IST).date()
    token_valid_today = placed_ist_date == today_ist_date
    # ──────────────────────────────────────────────────────────────────

    return {
        "id": order.id,
        "outlet_id": outlet.id,
        "outlet_name": outlet.name,
        "outlet_upi_id": outlet.upi_id,
        "user_id": user.id,
        "student_name": student.name if student else "Unknown",
        "student_register_number": student.register_no if student else "—",
        "status": order.status,
        "payment_status": order.payment_status,
        "payment_confirmed_by_vendor": order.payment_confirmed_by_vendor,
        "payment_gateway_id": order.payment_gateway_id,
        "total_price": order.total_price,
        "pickup_time": order.pickup_time,
        "token_number": order.token_number,
        "payment_method": order.payment_method,
        "placed_at": order.placed_at,
        "updated_at": order.updated_at,
        "items": items,
        "upi_deep_link": get_upi_deep_link(outlet, order),
        "can_cancel": order.status == "Placed" and order.payment_status == "PENDING",
        "can_rate": order.status == "Picked Up" and rating is None,
        "token_valid_today": token_valid_today,
    }
async def get_orders_by_user(db: AsyncSession, user_id: str) -> list:
    result = await db.execute(select(Order).where(Order.user_id == user_id).order_by(Order.placed_at.desc()))
    orders = result.scalars().all()
    return [await format_order_response(db, o) for o in orders]

async def get_orders_by_outlet(db: AsyncSession, outlet_id: str, status: str = None, date_str: str = None) -> list:
    query = select(Order).where(Order.outlet_id == outlet_id)
    if status:
        query = query.where(Order.status == status)
        
    today_ist = datetime.now(IST).date()
    target_date = today_ist if not date_str else datetime.strptime(date_str, "%Y-%m-%d").date()
    
    start_of_day = IST.localize(datetime(target_date.year, target_date.month, target_date.day))
    end_of_day = start_of_day + timedelta(days=1)
    
    start_utc = start_of_day.astimezone(pytz.UTC).replace(tzinfo=None)
    end_utc = end_of_day.astimezone(pytz.UTC).replace(tzinfo=None)
    
    query = query.where(Order.placed_at >= start_utc, Order.placed_at < end_utc)
    query = query.order_by(Order.placed_at.desc())
    
    result = await db.execute(query)
    orders = result.scalars().all()
    return [await format_order_response(db, o) for o in orders]

async def get_order_by_id(db: AsyncSession, order_id: str):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order:
        return None
    return await format_order_response(db, order)

async def confirm_payment_and_prepare(db: AsyncSession, order_id: str, vendor_id: str, payment_gateway_id: str = None):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    result = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = result.scalars().first()
    if str(outlet.vendor_id) != str(vendor_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if order.status != "Placed":
        raise HTTPException(status_code=400, detail="Order is not in Placed status")

    if order.payment_status == "COMPLETED":
        # ✅ Razorpay already verified — vendor just starting to prepare
        pass
    elif order.payment_status == "PENDING":
        # ⚠️ Fallback: vendor manually confirming (webhook may have failed)
        payment_res = PaymentService.verify_upi_payment(order, payment_gateway_id)
        order.payment_status = "COMPLETED"
        order.payment_gateway_id = payment_res["gateway_id"]
    else:
        raise HTTPException(status_code=400, detail="Cannot update order in current payment state")

    order.payment_confirmed_by_vendor = True
    order.status = "Preparing"
    order.updated_at = datetime.utcnow()

    db.add(Notification(
        user_id=order.user_id,
        message=f"🍳 Order #{order.token_number} is being prepared!",
        related_order_id=order.id
    ))

    await db.commit()
    return await format_order_response(db, order)

async def update_order_status(db: AsyncSession, order_id: str, new_status: str, vendor_id: str):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    result = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = result.scalars().first()
    if str(outlet.vendor_id) != str(vendor_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    valid_transitions = {"Preparing": "Ready for Pickup", "Ready for Pickup": "Picked Up"}
    if order.status not in valid_transitions or valid_transitions[order.status] != new_status:
        raise HTTPException(status_code=400, detail="Invalid status transition")
        
    order.status = new_status
    order.updated_at = datetime.utcnow()
    
    msg = ""
    if new_status == "Ready for Pickup":
        msg = f"Order #{order.token_number} is ready! Come pick it up 🎉"
    elif new_status == "Picked Up":
        msg = f"Order #{order.token_number} picked up! Enjoy your meal 😊 Rate us ⭐"
        
    if msg:
        notification = Notification(
            user_id=order.user_id,
            message=msg,
            related_order_id=order.id
        )
        db.add(notification)
        
    await db.commit()
    return await format_order_response(db, order)

async def cancel_order_by_student(db: AsyncSession, order_id: str, user_id: str, reason: str = None):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order or str(order.user_id) != str(user_id):
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != "Placed" or order.payment_status != "PENDING":
        raise HTTPException(status_code=400, detail="Cannot cancel after payment confirmed")
        
    order.status = "Cancelled"
    order.payment_status = "FAILED"
    order.cancellation_reason = reason
    order.updated_at = datetime.utcnow()
    
    notification = Notification(
        user_id=order.user_id,
        message=f"Order #{order.token_number} cancelled successfully.",
        related_order_id=order.id
    )
    db.add(notification)
    
    await db.commit()
    return await format_order_response(db, order)

async def cancel_order_by_vendor(db: AsyncSession, order_id: str, vendor_id: str, reason: str = None):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    result = await db.execute(select(Outlet).where(Outlet.id == order.outlet_id))
    outlet = result.scalars().first()
    if str(outlet.vendor_id) != str(vendor_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if order.status in ["Picked Up", "Cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed or already cancelled orders")
        
    order.status = "Cancelled"
    order.payment_status = PaymentService.get_payment_status_after_cancel()
    order.cancellation_reason = reason
    order.updated_at = datetime.utcnow()
    
    notification = Notification(
        user_id=order.user_id,
        message=f"Order #{order.token_number} was cancelled by vendor. Reason: {reason or 'No reason given'}",
        related_order_id=order.id
    )
    db.add(notification)
    
    await db.commit()
    return await format_order_response(db, order)

async def submit_rating(db: AsyncSession, order_id: str, user_id: str, stars: int, review: str = None):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalars().first()
    if not order or str(order.user_id) != str(user_id):
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status != "Picked Up":
        raise HTTPException(status_code=400, detail="Can only rate completed orders")
        
    result = await db.execute(select(Rating).where(Rating.order_id == order_id))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Order already rated")
        
    rating = Rating(
        user_id=user_id,
        outlet_id=order.outlet_id,
        order_id=order_id,
        stars=stars,
        review=review
    )
    db.add(rating)
    await db.commit()
    
    from app.outlets.service import recalculate_rating
    await recalculate_rating(db, str(order.outlet_id))
    
    return {"message": "Rating submitted successfully"}

async def get_outlet_stats(db: AsyncSession, outlet_id: str) -> dict:
    today_ist = datetime.now(IST).date()
    start_of_day = IST.localize(datetime(today_ist.year, today_ist.month, today_ist.day))
    start_of_day_utc = start_of_day.astimezone(pytz.UTC).replace(tzinfo=None)
    
    # 1. Total Orders
    res = await db.execute(select(func.count(Order.id)).where(Order.outlet_id == outlet_id))
    total_orders = res.scalar() or 0
    
    # 2. Active Orders
    res = await db.execute(select(func.count(Order.id)).where(Order.outlet_id == outlet_id, Order.status.not_in(["Picked Up", "Cancelled"])))
    active_orders = res.scalar() or 0
    
    # 3. Preparing Count
    res = await db.execute(select(func.count(Order.id)).where(Order.outlet_id == outlet_id, Order.status == "Preparing"))
    preparing_count = res.scalar() or 0
    
    # 4. Completed Today
    res = await db.execute(select(func.count(Order.id)).where(Order.outlet_id == outlet_id, Order.status == "Picked Up", Order.placed_at >= start_of_day_utc))
    completed_today = res.scalar() or 0
    
    # 5. Revenue Today
    res = await db.execute(select(func.sum(Order.total_price)).where(
        Order.outlet_id == outlet_id,
        Order.status.in_(["Preparing", "Ready for Pickup", "Picked Up"]),
        Order.placed_at >= start_of_day_utc
    ))
    revenue_today = res.scalar() or 0.0
    
    # 6. Total Revenue
    res = await db.execute(select(func.sum(Order.total_price)).where(
        Order.outlet_id == outlet_id,
        Order.status.in_(["Preparing", "Ready for Pickup", "Picked Up"])
    ))
    total_revenue = res.scalar() or 0.0
    
    # 7. Pending Payment Count
    res = await db.execute(select(func.count(Order.id)).where(Order.outlet_id == outlet_id, Order.payment_status == "PENDING"))
    pending_payment_count = res.scalar() or 0
    
    return {
        "total_orders": total_orders,
        "active_orders": active_orders,
        "preparing_count": preparing_count,
        "completed_today": completed_today,
        "revenue_today": revenue_today,
        "total_revenue": total_revenue,
        "pending_payment_count": pending_payment_count
    }
async def get_outlet_history(db: AsyncSession, outlet_id: str) -> list:
    today_ist = datetime.now(IST).date()
    result = []
    for i in range(30):
        target_date = today_ist - timedelta(days=i)
        start = IST.localize(datetime(target_date.year, target_date.month, target_date.day))
        end = start + timedelta(days=1)
        start_utc = start.astimezone(pytz.UTC).replace(tzinfo=None)
        end_utc = end.astimezone(pytz.UTC).replace(tzinfo=None)

        count_res = await db.execute(
            select(func.count(Order.id)).where(
                Order.outlet_id == outlet_id,
                Order.placed_at >= start_utc,
                Order.placed_at < end_utc
            )
        )
        revenue_res = await db.execute(
            select(func.sum(Order.total_price)).where(
                Order.outlet_id == outlet_id,
                Order.status.in_(["Preparing", "Ready for Pickup", "Picked Up"]),
                Order.placed_at >= start_utc,
                Order.placed_at < end_utc
            )
        )
        completed_res = await db.execute(
            select(func.count(Order.id)).where(
                Order.outlet_id == outlet_id,
                Order.status == "Picked Up",
                Order.placed_at >= start_utc,
                Order.placed_at < end_utc
            )
        )
        result.append({
            "date": str(target_date),
            "label": "Today" if i == 0 else target_date.strftime("%d %b %Y"),
            "order_count": count_res.scalar() or 0,
            "completed_count": completed_res.scalar() or 0,
            "revenue": float(revenue_res.scalar() or 0.0),
        })
    return result