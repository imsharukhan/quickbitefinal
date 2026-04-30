from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, func
from app.notifications.models import Notification
from app.orders.websocket import manager

async def create_notification(db: AsyncSession, user_id: str, message: str, related_order_id: str = None) -> Notification:
    if related_order_id:
        existing = await get_existing_notification(db, user_id, message, related_order_id)
        if existing:
            return existing

    notif = Notification(
        user_id=user_id,
        message=message,
        is_read=False,
        related_order_id=related_order_id
    )
    db.add(notif)
    await db.commit()
    await db.refresh(notif)
    
    await manager.notify_student(str(user_id), {
        "type": "NEW_NOTIFICATION",
        "notification": notif,
        "message": message,
        "related_order_id": related_order_id
    })
    return notif

async def get_existing_notification(db: AsyncSession, user_id: str, message: str, related_order_id: str) -> Notification | None:
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.related_order_id == related_order_id,
            Notification.message == message,
        )
    )
    return result.scalars().first()

async def get_user_notifications(db: AsyncSession, user_id: str) -> list[Notification]:
    result = await db.execute(
        select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
    )
    return list(result.scalars().all())

async def mark_as_read(db: AsyncSession, notif_id: str, user_id: str) -> Notification | None:
    result = await db.execute(
        select(Notification).where(Notification.id == notif_id, Notification.user_id == user_id)
    )
    notif = result.scalars().first()
    if notif:
        notif.is_read = True
        await db.commit()
        await db.refresh(notif)
    return notif

async def mark_all_read(db: AsyncSession, user_id: str) -> None:
    await db.execute(
        update(Notification).where(Notification.user_id == user_id, Notification.is_read == False).values(is_read=True)
    )
    await db.commit()

async def mark_all_read_and_list(db: AsyncSession, user_id: str) -> tuple[list[Notification], int]:
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    notifications = await get_user_notifications(db, user_id)
    return notifications, 0

async def get_unread_count(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(func.count(Notification.id)).where(Notification.user_id == user_id, Notification.is_read == False)
    )
    return result.scalar() or 0
