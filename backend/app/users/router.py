from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.users import schemas, service
from app.auth.dependencies import get_current_user
from app.users.models import User

router = APIRouter()

@router.get("/me", response_model=schemas.UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(User)
        .options(selectinload(User.student_profile))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    profile = user.student_profile
    return {
        "id": user.id,
        "name": profile.name if profile else "",
        "email": user.email,
        "register_number": profile.register_no if profile else "",
        "role": user.role,
        "is_verified": user.is_verified,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }

@router.patch("/me", response_model=schemas.UserResponse)
async def update_me(
    data: schemas.UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    user = await service.update_user(db, str(current_user.id), data)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await get_me(current_user=user, db=db)

@router.post("/change-password")
async def change_user_password(
    data: schemas.ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await service.change_password(db, str(current_user.id), data.old_password, data.new_password)
    return {"message": "Password changed successfully"}
