from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.outlets.models import Outlet
from app.outlets.schemas import OutletCreate, OutletUpdate
from app.orders.models import Order, Rating
import pytz
from datetime import datetime, timedelta

IST = pytz.timezone('Asia/Kolkata')

# Fixed order window — students can only order for 11:00 AM to 3:00 PM
ORDER_WINDOW_START = (11, 0)   # 11:00 AM
ORDER_WINDOW_END   = (15, 0)   # 3:00 PM

async def create_outlet(db: AsyncSession, data: OutletCreate) -> Outlet:
    new_outlet = Outlet(
        vendor_id=data.vendor_id,
        name=data.name,
        description=data.description,
        cuisine=data.cuisine,
        upi_id=data.upi_id,
        opening_time=data.opening_time,
        closing_time=data.closing_time,
        slot_duration_minutes=data.slot_duration_minutes,
        image_url=data.image_url,
        is_open=True
    )
    db.add(new_outlet)
    await db.commit()
    await db.refresh(new_outlet)
    return new_outlet

async def get_all_outlets(db: AsyncSession) -> list[Outlet]:
    result = await db.execute(select(Outlet).order_by(Outlet.name))
    return list(result.scalars().all())

async def get_outlet_by_id(db: AsyncSession, id: str) -> Outlet | None:
    result = await db.execute(select(Outlet).where(Outlet.id == id))
    return result.scalars().first()

async def get_outlets_by_vendor(db: AsyncSession, vendor_id: str) -> list[Outlet]:
    result = await db.execute(select(Outlet).where(Outlet.vendor_id == vendor_id).order_by(Outlet.name))
    return list(result.scalars().all())

async def update_outlet(db: AsyncSession, id: str, data: OutletUpdate) -> Outlet | None:
    outlet = await get_outlet_by_id(db, id)
    if not outlet:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(outlet, key, value)
    await db.commit()
    await db.refresh(outlet)
    return outlet

async def toggle_outlet_open(db: AsyncSession, id: str) -> Outlet | None:
    outlet = await get_outlet_by_id(db, id)
    if not outlet:
        return None
    outlet.is_open = not outlet.is_open
    await db.commit()
    await db.refresh(outlet)
    return outlet

async def recalculate_rating(db: AsyncSession, outlet_id: str):
    outlet = await get_outlet_by_id(db, outlet_id)
    if not outlet:
        return
    result = await db.execute(
        select(func.avg(Rating.stars)).where(Rating.outlet_id == outlet_id)
    )
    avg_rating = result.scalar()
    outlet.rating = float(avg_rating) if avg_rating else 0.0
    await db.commit()

async def validate_vendor_owns_outlet(db: AsyncSession, vendor_id: str, outlet_id: str) -> bool:
    outlet = await get_outlet_by_id(db, outlet_id)
    if not outlet:
        return False
    return str(outlet.vendor_id) == str(vendor_id)

async def get_available_time_slots(db: AsyncSession, outlet_id: str, date_str: str = None) -> list[dict]:
    outlet = await get_outlet_by_id(db, outlet_id)
    if not outlet or not outlet.is_open:
        return []

    now = datetime.now(IST)

    if not date_str:
        target_date = now.date()
    else:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()

    # Fixed order window: 11:00 AM to 3:00 PM IST
    order_start_dt = IST.localize(datetime(
        target_date.year, target_date.month, target_date.day,
        ORDER_WINDOW_START[0], ORDER_WINDOW_START[1]
    ))
    order_end_dt = IST.localize(datetime(
        target_date.year, target_date.month, target_date.day,
        ORDER_WINDOW_END[0], ORDER_WINDOW_END[1]
    ))

    # If today and already past 3:00 PM, no slots available
    if target_date == now.date() and now > order_end_dt:
        return []

    slot_duration = outlet.slot_duration_minutes or 15

    slots = []
    current_slot = order_start_dt

    while current_slot <= order_end_dt:
        slot_time_str = current_slot.strftime("%I:%M %p")

        slots.append({
            "time": slot_time_str,
            "available_slots": 999,
            "is_full": False
        })

        current_slot += timedelta(minutes=slot_duration)

    return slots