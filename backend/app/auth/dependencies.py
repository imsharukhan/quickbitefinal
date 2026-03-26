from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.auth.utils import decode_token
from app.users.models import User
from app.vendors.models import Vendor
from app.config import settings

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id: str = payload.get("sub")
    role: str = payload.get("role")
    token_type: str = payload.get("type", "access")

    if not user_id or role not in ["student", "staff"] or token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is deactivated")
        
    return user

async def get_current_vendor(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    token = credentials.credentials
    payload = decode_token(token)
    vendor_id: str = payload.get("sub")
    role: str = payload.get("role")
    token_type: str = payload.get("type", "access")

    if not vendor_id or role != "vendor" or token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid vendor token")

    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = result.scalars().first()

    if not vendor:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vendor not found")
    if not vendor.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Vendor is deactivated")
        
    return vendor

def get_current_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.ADMIN_SECRET_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid admin key")
    return True

async def get_current_user_or_vendor(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    role: str = payload.get("role")
    if role in ["student", "staff"]:
        user = await get_current_user(credentials, db)
        return user
    elif role == "vendor":
        vendor = await get_current_vendor(credentials, db)
        return vendor
    else:
        raise HTTPException(status_code=401, detail="Invalid token role")
