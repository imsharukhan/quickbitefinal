from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.notifications import schemas, service
from app.auth.dependencies import get_current_user

router = APIRouter()

@router.get("", response_model=schemas.NotificationListResponse)
async def get_notifications(current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    notifs = await service.get_user_notifications(db, str(current_user.id))
    unread_count = await service.get_unread_count(db, str(current_user.id))
    return {"notifications": notifs, "unread_count": unread_count}

@router.patch("/{id}/read", response_model=schemas.NotificationResponse)
async def mark_read(id: str, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    notif = await service.mark_as_read(db, id, str(current_user.id))
    if notif is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif

@router.patch("/read-all", response_model=schemas.NotificationListResponse)
async def mark_all_read(current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    notifications, unread_count = await service.mark_all_read_and_list(db, str(current_user.id))
    return {"notifications": notifications, "unread_count": unread_count}
