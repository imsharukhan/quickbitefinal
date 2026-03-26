from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.outlets.models import Outlet
from app.outlets.schemas import OutletCreate, OutletUpdate
from app.orders.models import Order, Rating
import pytz
from datetime import datetime, timedelta

IST = pytz.timezone('Asia/Kolkata')

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
        max_orders_per_slot=data.max_orders_per_slot,
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
        
    try:
        opening_time_parts = outlet.opening_time.split(":")
        closing_time_parts = outlet.closing_time.split(":")
        
        opening_dt = IST.localize(datetime(
            target_date.year, target_date.month, target_date.day,
            int(opening_time_parts[0]), int(opening_time_parts[1])
        ))
        
        closing_dt = IST.localize(datetime(
            target_date.year, target_date.month, target_date.day,
            int(closing_time_parts[0]), int(closing_time_parts[1])
        ))
    except (ValueError, IndexError):
        return []
    
    if now > closing_dt and target_date == now.date():
        return []
        
    slots = []
    current_slot = opening_dt
    
    while current_slot <= closing_dt:
        if target_date > now.date() or current_slot >= now + timedelta(minutes=30):
            slot_time_str = current_slot.strftime("%I:%M %p")
            
            start_of_day = IST.localize(datetime(target_date.year, target_date.month, target_date.day))
            start_of_day_utc = start_of_day.astimezone(pytz.UTC).replace(tzinfo=None)
            
            result = await db.execute(
                select(func.count(Order.id)).where(
                    Order.outlet_id == outlet.id,
                    Order.pickup_time == slot_time_str,
                    Order.placed_at >= start_of_day_utc,
                    Order.status != "Cancelled"
                )
            )
            count = result.scalar()
            
            available = outlet.max_orders_per_slot - count
            is_full = available <= 0
            
            if not is_full:
                slots.append({
                    "time": slot_time_str,
                    "available_slots": available,
                    "is_full": is_full
                })
                
        current_slot += timedelta(minutes=outlet.slot_duration_minutes)
        
    return slots
