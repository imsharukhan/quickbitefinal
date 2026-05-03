from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.menu.models import MenuItem
from app.outlets.models import Outlet
from app.menu.schemas import MenuItemCreate, MenuItemUpdate
from sqlalchemy import func
from datetime import datetime, timedelta
import pytz

IST = pytz.timezone('Asia/Kolkata')

async def create_menu_item(db: AsyncSession, outlet_id: str, data: MenuItemCreate) -> MenuItem:
    item = MenuItem(
        outlet_id=outlet_id,
        name=data.name,
        description=data.description,
        price=data.price,
        category=data.category,
        is_veg=data.is_veg,
        is_bestseller=data.is_bestseller,
        image_url=data.image_url,
        is_available=True,
        daily_limit=data.daily_limit if data.daily_limit and data.daily_limit > 0 else None,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


import json
from typing import Optional

MENU_CACHE_TTL = 45  # seconds — short enough to reflect limit changes

_redis_client = None

async def _get_redis():
    global _redis_client
    if _redis_client is None:
        import redis.asyncio as aioredis
        from app.config import settings
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=10,  # shared pool, not per-call
        )
    return _redis_client

async def get_menu_by_outlet(db: AsyncSession, outlet_id: str, include_unavailable: bool = False) -> list:
    from app.orders.models import Order, OrderItem as OI

    # Cache only student-facing view (vendor needs live data)
    cache_key = f"menu:outlet:{outlet_id}"
    if not include_unavailable:
        try:
            redis = await _get_redis()
            cached = await redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass  # Redis down = fall through to DB, never crash

    conditions = [
        MenuItem.outlet_id == outlet_id,
        MenuItem.is_deleted == False,
    ]
    if not include_unavailable:
        conditions.append(MenuItem.is_available == True)
    query = select(MenuItem).where(*conditions).order_by(MenuItem.category)
    result = await db.execute(query)
    items = list(result.scalars().all())

    if not items:
        return []

    # Batch count today's COMPLETED order quantities for all items in one query
    today_ist = datetime.now(IST).date()
    start_utc = IST.localize(datetime(today_ist.year, today_ist.month, today_ist.day)).astimezone(pytz.UTC).replace(tzinfo=None)
    end_utc = start_utc + timedelta(days=1)

    item_ids = [item.id for item in items]
    counts_res = await db.execute(
        select(OI.menu_item_id, func.sum(OI.quantity).label('total'))
        .join(Order, Order.id == OI.order_id)
        .where(
            OI.menu_item_id.in_(item_ids),
            Order.payment_status == 'COMPLETED',
            Order.placed_at >= start_utc,
            Order.placed_at < end_utc,
        )
        .group_by(OI.menu_item_id)
    )
    counts = {str(row.menu_item_id): int(row.total) for row in counts_res.fetchall()}

    result_list = []
    for item in items:
        orders_today = counts.get(str(item.id), 0)
        limit_reached = item.daily_limit is not None and orders_today >= item.daily_limit
        result_list.append({
            "id": item.id,
            "outlet_id": item.outlet_id,
            "name": item.name,
            "description": item.description,
            "price": item.price,
            "category": item.category,
            "is_veg": item.is_veg,
            "is_available": item.is_available and not limit_reached,  # auto sold-out
            "is_bestseller": item.is_bestseller,
            "image_url": item.image_url,
            "daily_limit": item.daily_limit,
            "orders_today": orders_today,
        })

    if not include_unavailable:
        try:
            redis = await _get_redis()
            await redis.setex(cache_key, MENU_CACHE_TTL, json.dumps(result_list, default=str))
        except Exception:
            pass
    return result_list

async def get_menu_item(db: AsyncSession, id: str) -> MenuItem | None:
    result = await db.execute(
        select(MenuItem).where(MenuItem.id == id, MenuItem.is_deleted == False)
    )
    return result.scalars().first()

async def update_menu_item(db: AsyncSession, id: str, data: MenuItemUpdate) -> MenuItem | None:
    item = await get_menu_item(db, id)
    if not item:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        # daily_limit=0 means "remove limit" → store as NULL
        if key == "daily_limit" and value == 0:
            value = None
        setattr(item, key, value)
    await db.commit()
    await db.refresh(item)
    try:
        redis = await _get_redis()
        await redis.delete(f"menu:outlet:{item.outlet_id}")
    except Exception:
        pass
    return item

async def toggle_availability(db: AsyncSession, id: str) -> MenuItem | None:
    item = await get_menu_item(db, id)
    if not item:
        return None
    item.is_available = not item.is_available
    await db.commit()
    await db.refresh(item)
    try:
        redis = await _get_redis()
        await redis.delete(f"menu:outlet:{item.outlet_id}")
    except Exception:
        pass
    return item

async def delete_menu_item(db: AsyncSession, id: str) -> bool:
    # FIX: Use is_deleted=True so it's permanently hidden from everyone,
    # but the DB row stays so existing OrderItem FK references don't break.
    item = await get_menu_item(db, id)
    if not item:
        return False
    item.is_deleted = True
    item.is_available = False  # also mark unavailable just in case
    await db.commit()
    return True

async def validate_vendor_owns_outlet(db: AsyncSession, vendor_id: str, outlet_id: str) -> bool:
    result = await db.execute(select(Outlet).where(Outlet.id == outlet_id))
    outlet = result.scalars().first()
    if not outlet:
        return False
    return str(outlet.vendor_id) == str(vendor_id)