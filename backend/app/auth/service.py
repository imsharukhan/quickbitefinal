from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.users.models import User
from app.vendors.models import Vendor
from app.auth.utils import hash_password, verify_password
from app.config import settings
from sqlalchemy.orm import selectinload
import resend

# Initialise Resend once at import time
resend.api_key = settings.RESEND_API_KEY


# ── User / Student helpers ─────────────────────────────────────────────────────

async def create_user(db: AsyncSession, data):
    new_user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role,
        is_verified=False if data.email else True,
        must_change_password=False
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
    stmt = (
        select(User)
        .join(Student)
        .where(Student.register_no == reg_no)
        .options(selectinload(User.student_profile))
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_user_by_email(db: AsyncSession, email: str):
    stmt = (
        select(User)
        .where(User.email == email)
        .options(selectinload(User.student_profile), selectinload(User.vendor_profile))
    )
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_vendor_by_phone(db: AsyncSession, phone: str):
    """Used for vendor LOGIN (unchanged)."""
    stmt = select(Vendor).where(Vendor.phone == phone).options(selectinload(Vendor.user))
    result = await db.execute(stmt)
    return result.scalars().first()


async def get_vendor_by_email(db: AsyncSession, email: str):
    """
    Used for vendor FORGOT PASSWORD.
    Email lives on User, so we join Vendor → User and filter by User.email.
    """
    stmt = (
        select(Vendor)
        .join(User, Vendor.user_id == User.id)
        .where(User.email == email)
        .options(selectinload(Vendor.user))
    )
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


async def reset_vendor_password_otp(db: AsyncSession, email: str, new_password: str):
    """CHANGED: was phone-based, now email-based lookup."""
    vendor = await get_vendor_by_email(db, email)
    if vendor and vendor.user:
        vendor.user.hashed_password = hash_password(new_password)
        await db.commit()


# ── Email sending via Resend ───────────────────────────────────────────────────

def _build_email_html(name: str, otp: str, purpose: str) -> tuple[str, str]:
    """Returns (subject, html_body) for an OTP email."""
    if purpose == "verify":
        subject = "QuickBite – Verify your email"
        action_label = "Email Verification"
        message = "You're almost there! Use the OTP below to verify your QuickBite account."
        note = "This OTP expires in <strong>10 minutes</strong>. If you didn't create an account, you can safely ignore this email."
    else:  # reset
        subject = "QuickBite – Password Reset OTP"
        action_label = "Password Reset"
        message = "We received a request to reset your QuickBite password. Use the OTP below to proceed."
        note = "This OTP expires in <strong>10 minutes</strong>. If you didn't request a reset, please ignore this email."

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0"
                   style="background:#ffffff;border-radius:12px;overflow:hidden;
                          box-shadow:0 2px 8px rgba(0,0,0,0.08);">

              <!-- Header -->
              <tr>
                <td style="background:#ff6b35;padding:28px 32px;text-align:center;">
                  <span style="color:#ffffff;font-size:26px;font-weight:700;
                               letter-spacing:-0.5px;">⚡ QuickBite</span>
                  <p style="color:#ffe8df;margin:6px 0 0;font-size:13px;">
                    Campus Pre-Order Platform
                  </p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:36px 32px;">
                  <p style="margin:0 0 8px;font-size:15px;color:#374151;">
                    Hi <strong>{name}</strong>,
                  </p>
                  <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                    {message}
                  </p>

                  <!-- OTP Box -->
                  <div style="background:#f9fafb;border:2px dashed #ff6b35;border-radius:10px;
                              padding:24px;text-align:center;margin-bottom:28px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;
                               text-transform:uppercase;letter-spacing:1px;">
                      {action_label} OTP
                    </p>
                    <p style="margin:0;font-size:40px;font-weight:700;
                               letter-spacing:12px;color:#ff6b35;">
                      {otp}
                    </p>
                  </div>

                  <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                    {note}
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#f9fafb;padding:20px 32px;text-align:center;
                            border-top:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:12px;color:#d1d5db;">
                    &copy; 2025 QuickBite &nbsp;·&nbsp; Campus Food Pre-Order
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """
    return subject, html


async def send_otp_email(email: str, name: str, otp: str, purpose: str = "verify"):
    """
    Send an OTP email via Resend.
    `purpose` is either "verify" (account creation) or "reset" (password reset).
    """
    subject, html = _build_email_html(name, otp, purpose)
    try:
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [email],
            "subject": subject,
            "html": html,
        })
    except Exception as exc:
        # Log but don't crash the request — OTP is already in Redis
        print(f"[Resend] Failed to send email to {email}: {exc}")