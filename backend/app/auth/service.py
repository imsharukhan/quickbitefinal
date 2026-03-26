from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.users.models import User
from app.vendors.models import Vendor
from app.auth.utils import hash_password, verify_password
from app.config import settings
import aiosmtplib
from email.message import EmailMessage

async def create_user(db: AsyncSession, data):
    new_user = User(
        name=data.name,
        register_number=data.register_number,
        email=data.email,
        password_hash=hash_password(data.password),
        role=data.role,
        is_verified=False if data.email else True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

async def get_user_by_register_number(db: AsyncSession, reg_no: str):
    result = await db.execute(select(User).where(User.register_number == reg_no))
    return result.scalars().first()

async def get_user_by_email(db: AsyncSession, email: str):
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()

async def get_vendor_by_phone(db: AsyncSession, phone: str):
    result = await db.execute(select(Vendor).where(Vendor.phone == phone))
    return result.scalars().first()

async def authenticate_user(db: AsyncSession, register_number: str, password: str):
    user = await get_user_by_register_number(db, register_number)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user

async def authenticate_vendor(db: AsyncSession, phone: str, password: str):
    vendor = await get_vendor_by_phone(db, phone)
    if not vendor:
        return None
    if not verify_password(password, vendor.password_hash):
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
        user.password_hash = hash_password(new_password)
        await db.commit()

async def send_otp_email(email: str, name: str, otp: str, purpose: str = "verify"):
    msg = EmailMessage()
    subject = "Verify your QuickBite account" if purpose == "verify" else "Reset your QuickBite password"
    msg["Subject"] = subject
    msg["From"] = settings.GMAIL_ADDRESS
    msg["To"] = email

    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
          <div style="background-color: orange; padding: 15px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">QuickBite</h1>
          </div>
          <div style="padding: 20px; text-align: center;">
            <h2>Hi {name},</h2>
            <p>{subject}. Use the OTP below:</p>
            <div style="margin: 20px 0;">
              <span style="background-color: #fff3e0; color: orange; font-size: 2.5rem; letter-spacing: 12px; padding: 10px 20px; border: 2px dashed orange; border-radius: 8px; font-weight: bold;">{otp}</span>
            </div>
            <p style="color: #666;">Valid for 10 minutes</p>
            <p style="font-size: 0.9em; color: dimgray; margin-top: 30px;">Do not share this OTP with anyone.</p>
          </div>
        </div>
      </body>
    </html>
    """
    msg.set_content(html_content, subtype="html")

    await aiosmtplib.send(
        msg,
        hostname="smtp.gmail.com",
        port=587,
        start_tls=True,
        username=settings.GMAIL_ADDRESS,
        password=settings.GMAIL_APP_PASSWORD,
    )
