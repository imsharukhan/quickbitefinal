from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.menu.models import MenuItem
from app.outlets.models import Outlet
from app.menu.schemas import MenuItemCreate, MenuItemUpdate

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
        is_available=True
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

async def get_menu_by_outlet(db: AsyncSession, outlet_id: str, include_unavailable: bool = False) -> list[MenuItem]:
    query = select(MenuItem).where(MenuItem.outlet_id == outlet_id)
    if not include_unavailable:
        query = query.where(MenuItem.is_available == True)
    query = query.order_by(MenuItem.category)
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_menu_item(db: AsyncSession, id: str) -> MenuItem | None:
    result = await db.execute(select(MenuItem).where(MenuItem.id == id))
    return result.scalars().first()

async def update_menu_item(db: AsyncSession, id: str, data: MenuItemUpdate) -> MenuItem | None:
    item = await get_menu_item(db, id)
    if not item:
        return None
        
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
        
    await db.commit()
    await db.refresh(item)
    return item

async def toggle_availability(db: AsyncSession, id: str) -> MenuItem | None:
    item = await get_menu_item(db, id)
    if not item:
        return None
    item.is_available = not item.is_available
    await db.commit()
    await db.refresh(item)
    return item

async def delete_menu_item(db: AsyncSession, id: str) -> bool:
    item = await get_menu_item(db, id)
    if not item:
        return False
    item.is_available = False
    await db.commit()
    return True

async def validate_vendor_owns_outlet(db: AsyncSession, vendor_id: str, outlet_id: str) -> bool:
    result = await db.execute(select(Outlet).where(Outlet.id == outlet_id))
    outlet = result.scalars().first()
    if not outlet:
        return False
    return str(outlet.vendor_id) == str(vendor_id)
