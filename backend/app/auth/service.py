from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.users.models import User
from app.vendors.models import Vendor
from app.auth.utils import hash_password, verify_password
from app.config import settings
import aiosmtplib
from email.message import EmailMessage

from sqlalchemy.orm import selectinload

async def create_user(db: AsyncSession, data):
    new_user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_verified=False if data.email else True
    )
    db.add(new_user)
    await db.flush()
    
    from app.users.models import Student
    new_student = Student(
        user_id=new_user.id,
        register_no=data.register_number,
        name=data.name
    )
    db.add(new_student)
    await db.commit()
    await db.refresh(new_user)
    return new_user

async def get_user_by_register_number(db: AsyncSession, reg_no: str):
    from app.users.models import Student
    stmt = select(User).join(Student).where(Student.register_no == reg_no).options(selectinload(User.student_profile))
    result = await db.execute(stmt)
    return result.scalars().first()

async def get_user_by_email(db: AsyncSession, email: str):
    stmt = select(User).where(User.email == email).options(selectinload(User.student_profile), selectinload(User.vendor_profile))
    result = await db.execute(stmt)
    return result.scalars().first()

async def get_vendor_by_phone(db: AsyncSession, phone: str):
    stmt = select(Vendor).where(Vendor.phone == phone).options(selectinload(Vendor.user))
    result = await db.execute(stmt)
    return result.scalars().first()

async def authenticate_user(db: AsyncSession, register_number: str, password: str):
    user = await get_user_by_register_number(db, register_number)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user

async def authenticate_vendor(db: AsyncSession, phone: str, password: str):
    vendor = await get_vendor_by_phone(db, phone)
    if not vendor or not vendor.user:
        return None
    if not verify_password(password, vendor.user.hashed_password):
        return None
    return vendor

async def mark_user_verified(db: AsyncSession, register_number: str):
    user = await get_user_by_register_number(db, register_number)
    if user:
        user.is_verified = True
        await db.commit()

async def reset_user_password(db: AsyncSession, register_number: str, new_password: str):
    user = await get_user_by_register_number(db, register_number)
    if user:
        user.hashed_password = hash_password(new_password)
        await db.commit()

async def reset_vendor_password_otp(db: AsyncSession, phone: str, new_password: str):
    vendor = await get_vendor_by_phone(db, phone)
    if vendor and vendor.user:
        vendor.user.hashed_password = hash_password(new_password)
        await db.commit()

async def send_otp_email(email_or_phone: str, name: str, otp: str, purpose: str = "verify"):
    # [DEMO MODE] - Print OTP directly to terminal instead of using SMS/Email API
    action = "Verification" if purpose == "verify" else "Reset"
    print("\n" + "="*50)
    print(f"[DEMO MODE] QUICKBITE OTP ({action})")
    print(f"Recipient: {name} ({email_or_phone})")
    print(f"Your 6-digit OTP is: {otp}")
    print("="*50 + "\n")
