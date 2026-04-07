from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.redis_client import redis_client
from app.config import settings
from app.auth import schemas, service, utils
from app.auth.dependencies import get_current_user, get_current_vendor, get_current_user_or_vendor
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.dependencies import get_current_user, get_current_vendor, get_current_user_or_vendor

security = HTTPBearer()
router = APIRouter()

def check_otp_rate_limit(register_number: str):
    count = redis_client.get(f"otp_count:{register_number}")
    if count and int(count) >= 3:
        raise HTTPException(status_code=429, detail="Too many OTP requests. Try again after 1 hour.")

def increment_otp_count(register_number: str):
    key = f"otp_count:{register_number}"
    count = redis_client.incr(key)
    if count == 1:
        redis_client.expire(key, 3600)

# ── Student: Register ──────────────────────────────────────────────────────────
@router.post("/register")
async def register(data: schemas.StudentRegister, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    if not utils.validate_register_number(data.register_number):
        raise HTTPException(status_code=400, detail="Invalid register number format")

    existing_user = await service.get_user_by_register_number(db, data.register_number)
    if existing_user:
        raise HTTPException(status_code=400, detail="Register number already registered")

    if data.email:
        existing_email = await service.get_user_by_email(db, data.email)
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        check_otp_rate_limit(data.register_number)

    user = await service.create_user(db, data)

    if data.email:
        otp = utils.generate_otp()
        redis_client.set(f"otp:{data.register_number}", otp, ex=600)
        increment_otp_count(data.register_number)
        background_tasks.add_task(service.send_otp_email, data.email, data.name, otp, "verify")
        return {"message": "User registered successfully. OTP sent.", "user_id": str(user.id), "requires_otp": True}

    access_token = utils.create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = utils.create_refresh_token({"sub": str(user.id), "role": user.role})
    redis_client.set(f"refresh:{user.id}", refresh_token, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)

    return {
        "message": "User registered successfully.",
        "requires_otp": False,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": user.role,
        "user_id": str(user.id),
        "name": user.student_profile.name if user.student_profile else "",
        "must_change_password": False  # Students never need to change password on register
    }

# ── Student: Verify OTP ────────────────────────────────────────────────────────
@router.post("/verify-otp")
async def verify_otp(data: schemas.VerifyOTP, db: AsyncSession = Depends(get_db)):
    key = f"otp:{data.register_number}"
    stored_otp = redis_client.get(key)

    if not stored_otp:
        raise HTTPException(status_code=400, detail="OTP expired")
    if str(stored_otp) != str(data.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    user = await service.get_user_by_register_number(db, data.register_number)
    await service.mark_user_verified(db, data.register_number)
    redis_client.delete(key)

    if user:
        access_token = utils.create_access_token({"sub": str(user.id), "role": user.role})
        refresh_token = utils.create_refresh_token({"sub": str(user.id), "role": user.role})
        redis_client.set(f"refresh:{user.id}", refresh_token, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)
        return {
            "message": "Email verified successfully",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": user.role,
            "user_id": str(user.id),
            "name": user.student_profile.name if user.student_profile else "",
            "must_change_password": False
        }
    return {"message": "Email verified successfully"}

# ── Student: Resend OTP ────────────────────────────────────────────────────────
@router.post("/resend-otp")
async def resend_otp(data: schemas.ResendOTP, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    check_otp_rate_limit(data.register_number)
    user = await service.get_user_by_register_number(db, data.register_number)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.email:
        raise HTTPException(status_code=400, detail="User has no email registered")

    otp = utils.generate_otp()
    redis_client.set(f"otp:{data.register_number}", otp, ex=600)
    increment_otp_count(data.register_number)
    background_tasks.add_task(service.send_otp_email, user.email, user.student_profile.name if user.student_profile else "User", otp, "verify")
    return {"message": "OTP resent successfully"}

# ── Student: Forgot Password ───────────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(data: schemas.ForgotPassword, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    user = await service.get_user_by_email(db, data.email)
    msg = "If that email is registered, an OTP has been sent"
    if user:
        try:
            check_otp_rate_limit(user.student_profile.register_no if user.student_profile else str(user.id))
            otp = utils.generate_otp()
            redis_client.set(f"reset:{user.student_profile.register_no if user.student_profile else user.id}", otp, ex=600)
            increment_otp_count(user.student_profile.register_no if user.student_profile else str(user.id))
            background_tasks.add_task(service.send_otp_email, user.email, user.student_profile.name if user.student_profile else "User", otp, "reset")
        except HTTPException:
            pass
    return {"message": msg}

# ── Student: Reset Password ────────────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(data: schemas.ResetPassword, db: AsyncSession = Depends(get_db)):
    key = f"reset:{data.register_number}"
    stored_otp = redis_client.get(key)

    if not stored_otp:
        raise HTTPException(status_code=400, detail="OTP expired or not requested")
    if str(stored_otp) != str(data.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    await service.reset_user_password(db, data.register_number, data.new_password)
    redis_client.delete(key)
    return {"message": "Password reset successfully"}

# ── Unified Login (Student + Vendor) ──────────────────────────────────────────
@router.post("/login", response_model=schemas.TokenResponse)
async def login(data: schemas.UserLogin, db: AsyncSession = Depends(get_db)):
    identifier = str(data.register_number).strip()
    user = None
    vendor = None
    role_type = None
    display_name = "User"
    must_change_pw = False

    if len(identifier) == 10 and identifier.isdigit():
        # ── Vendor path ──
        vendor = await service.authenticate_vendor(db, identifier, data.password)
        if vendor:
            user = vendor.user
            role_type = "vendor"
            display_name = vendor.business_name
            must_change_pw = vendor.must_change_password  # ✅ From Vendor model
    else:
        # ── Student path ──
        user = await service.authenticate_user(db, identifier, data.password)
        if user:
            role_type = "student"
            display_name = user.student_profile.name if user.student_profile else "Student"
            must_change_pw = False  # ✅ Students never forced to change

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your ID/Phone and password."
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled.")

    access_token = utils.create_access_token({"sub": str(user.id), "role": role_type})
    refresh_token = utils.create_refresh_token({"sub": str(user.id), "role": role_type})
    redis_client.set(f"refresh:{user.id}", refresh_token, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": role_type,
        "user_id": str(user.id),
        "name": display_name,
        "must_change_password": must_change_pw
    }

# ── ✅ NEW: Dedicated Vendor Login (Frontend was calling this route) ────────────
@router.post("/vendor/login", response_model=schemas.TokenResponse)
async def vendor_login(data: schemas.VendorLogin, db: AsyncSession = Depends(get_db)):
    phone = str(data.phone).strip()

    if not (len(phone) == 10 and phone.isdigit()):
        raise HTTPException(status_code=400, detail="Invalid phone number format.")

    vendor = await service.authenticate_vendor(db, phone, data.password)

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password."
        )

    if not vendor.user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled.")

    access_token = utils.create_access_token({"sub": str(vendor.user.id), "role": "vendor"})
    refresh_token = utils.create_refresh_token({"sub": str(vendor.user.id), "role": "vendor"})
    session_key = f"refresh:vendor:{vendor.user.id}:{refresh_token[-12:]}"
    redis_client.set(session_key, refresh_token, ex=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "role": "vendor",
        "user_id": str(vendor.user.id),
        "name": vendor.business_name,
        "must_change_password": vendor.must_change_password  # ✅ Correct field, correct model
    }

# ── Change Password (unified) ──────────────────────────────────────────────────
@router.post("/change-password")
async def change_password(data: schemas.ChangePassword, current_user=Depends(get_current_user_or_vendor), db: AsyncSession = Depends(get_db)):
    if hasattr(current_user, 'user'):  # Vendor object
        current_user.user.hashed_password = utils.hash_password(data.new_password)
        current_user.must_change_password = False  # ✅ On Vendor model
    else:
        current_user.hashed_password = utils.hash_password(data.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}

# ── Vendor: Change Password (with old password verification) ──────────────────
@router.post("/vendor/change-password")
async def vendor_change_password(data: schemas.VendorChangePassword, current_vendor=Depends(get_current_vendor), db: AsyncSession = Depends(get_db)):
    if not utils.verify_password(data.old_password, current_vendor.user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid old password")

    current_vendor.user.hashed_password = utils.hash_password(data.new_password)
    current_vendor.must_change_password = False  # ✅ On Vendor model
    await db.commit()
    return {"message": "Password changed successfully"}

# ── Vendor: Forgot Password ────────────────────────────────────────────────────
@router.post("/vendor/forgot-password")
async def vendor_forgot_password(data: schemas.VendorForgotPassword, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    vendor = await service.get_vendor_by_phone(db, data.phone)
    msg = "If that phone is registered, an OTP has been sent."
    if vendor:
        try:
            check_otp_rate_limit(vendor.phone)
            otp = utils.generate_otp()
            redis_client.set(f"reset_vendor:{vendor.phone}", otp, ex=600)
            increment_otp_count(vendor.phone)
            background_tasks.add_task(service.send_otp_email, vendor.phone, vendor.business_name, otp, "reset")
        except HTTPException:
            pass
    return {"message": msg}

# ── Vendor: Reset Password via OTP ────────────────────────────────────────────
@router.post("/vendor/reset-password")
async def vendor_reset_password(data: schemas.VendorResetPassword, db: AsyncSession = Depends(get_db)):
    key = f"reset_vendor:{data.phone}"
    stored_otp = redis_client.get(key)

    if not stored_otp:
        raise HTTPException(status_code=400, detail="OTP expired or not requested")
    if str(stored_otp) != str(data.otp):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    await service.reset_vendor_password_otp(db, data.phone, data.new_password)
    redis_client.delete(key)
    return {"message": "Password reset successfully"}

# ── Admin: Force Reset Vendor Password ────────────────────────────────────────
@router.post("/vendor/reset-password/admin", tags=["admin"])
async def reset_vendor_password(phone: str, new_password: str, db: AsyncSession = Depends(get_db)):
    vendor = await service.get_vendor_by_phone(db, phone)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    vendor.user.hashed_password = utils.hash_password(new_password)
    vendor.must_change_password = True  # ✅ On Vendor model
    await db.commit()
    return {"message": "Vendor password reset by Admin. Vendor forced to change on next login."}

# ── Token Refresh ──────────────────────────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(data: schemas.RefreshRequest):
    try:
        payload = utils.decode_token(data.refresh_token)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    role = payload.get("role")

    if not user_id or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token payload")

    if role == "vendor":
        keys = redis_client.keys(f"refresh:vendor:{user_id}:*")
        valid = any(redis_client.get(k) == data.refresh_token for k in (keys or []))
        if not valid:
            raise HTTPException(status_code=401, detail="Refresh token expired or invalid")
    else:
        stored_token = redis_client.get(f"refresh:{user_id}")
        if not stored_token or str(stored_token) != data.refresh_token:
            raise HTTPException(status_code=401, detail="Refresh token expired or invalid")

    access_token = utils.create_access_token({"sub": user_id, "role": role})
    return {"access_token": access_token}

# ── Logout ─────────────────────────────────────────────────────────────────────
@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security), current=Depends(get_current_user_or_vendor)):
    # For vendors delete only THIS device's session, not all sessions
    token = credentials.credentials
    payload = utils.decode_token(token)
    role = payload.get("role")
    user_id = str(current.user.id if hasattr(current, 'user') else current.id)

    if role == "vendor":
        keys = redis_client.keys(f"refresh:vendor:{user_id}:*")
        # We can't match exact token here since we only have the access token
        # So delete all sessions for this vendor on explicit logout
        for k in (keys or []):
            redis_client.delete(k)
    else:
        redis_client.delete(f"refresh:{user_id}")
    return {"message": "Logged out successfully"}