from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.vendors.models import Vendor
from app.vendors.schemas import VendorCreate, VendorUpdate
from app.auth.utils import hash_password

async def create_vendor(db: AsyncSession, data: VendorCreate) -> Vendor:
    new_vendor = Vendor(
        name=data.name,
        phone=data.phone,
        password_hash=hash_password(data.initial_password),
        must_change_password=True,
        is_active=True
    )
    db.add(new_vendor)
    await db.commit()
    await db.refresh(new_vendor)
    return new_vendor

async def get_all_vendors(db: AsyncSession) -> list[Vendor]:
    result = await db.execute(select(Vendor).order_by(Vendor.name))
    return list(result.scalars().all())

async def get_vendor_by_id(db: AsyncSession, id: str) -> Vendor | None:
    result = await db.execute(select(Vendor).where(Vendor.id == id))
    return result.scalars().first()

async def update_vendor(db: AsyncSession, id: str, data: VendorUpdate) -> Vendor | None:
    vendor = await get_vendor_by_id(db, id)
    if not vendor:
        return None
    
    if data.name is not None:
        vendor.name = data.name
    if data.phone is not None:
        vendor.phone = data.phone
        
    await db.commit()
    await db.refresh(vendor)
    return vendor

async def toggle_vendor_active(db: AsyncSession, id: str) -> Vendor | None:
    vendor = await get_vendor_by_id(db, id)
    if not vendor:
        return None
    vendor.is_active = not vendor.is_active
    await db.commit()
    await db.refresh(vendor)
    return vendor
