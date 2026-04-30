from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.auth.utils import hash_password
from app.users.models import User
from app.vendors.models import Vendor
from app.vendors.schemas import VendorCreate, VendorUpdate


async def create_vendor(db: AsyncSession, data: VendorCreate) -> Vendor:
    user = User(
        email=data.email,
        role="vendor",
        hashed_password=hash_password(data.initial_password),
        is_active=True,
        is_verified=True,
        must_change_password=True,
    )
    db.add(user)
    await db.flush()

    vendor = Vendor(
        user_id=user.id,
        phone=data.phone,
        business_name=data.business_name,
        must_change_password=True,
        is_active=True,
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


async def get_all_vendors(db: AsyncSession) -> list[Vendor]:
    result = await db.execute(select(Vendor).order_by(Vendor.business_name))
    return list(result.scalars().all())


async def get_vendor_by_id(db: AsyncSession, id: str) -> Vendor | None:
    result = await db.execute(select(Vendor).where(Vendor.id == id).options(selectinload(Vendor.user)))
    return result.scalars().first()


async def update_vendor(db: AsyncSession, id: str, data: VendorUpdate) -> Vendor | None:
    vendor = await get_vendor_by_id(db, id)
    if not vendor:
        return None

    if data.business_name is not None:
        vendor.business_name = data.business_name
    if data.phone is not None:
        vendor.phone = data.phone
    if data.email is not None and vendor.user:
        vendor.user.email = data.email

    await db.commit()
    await db.refresh(vendor)
    return vendor


async def toggle_vendor_active(db: AsyncSession, id: str) -> Vendor | None:
    vendor = await get_vendor_by_id(db, id)
    if not vendor:
        return None
    vendor.is_active = not vendor.is_active
    if vendor.user:
        vendor.user.is_active = vendor.is_active
    await db.commit()
    await db.refresh(vendor)
    return vendor
