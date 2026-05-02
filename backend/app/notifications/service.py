from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, func
from app.notifications.models import Notification
from app.orders.websocket import manager
import asyncio


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
 
    # FIX: Fire WebSocket as background task — don't hold DB connection while sending
    # If WebSocket is slow or student is offline, it won't delay order processing
    notif_id   = str(notif.id)
    notif_uid  = str(notif.user_id)
    notif_oid  = str(notif.related_order_id) if notif.related_order_id else None
    notif_read = notif.is_read
    notif_at   = notif.created_at.isoformat() if notif.created_at else None
 
    asyncio.create_task(_send_ws_notification(
        user_id=str(user_id),
        payload={
            "type": "NEW_NOTIFICATION",
            "notification": {
                "id": notif_id,
                "user_id": notif_uid,
                "message": message,
                "is_read": notif_read,
                "related_order_id": notif_oid,
                "created_at": notif_at,
            },
            "message": message,
            "related_order_id": notif_oid,
        }
    ))
    return notif
 
 
async def _send_ws_notification(user_id: str, payload: dict):
    """Fire-and-forget WebSocket push — runs after DB connection is released."""
    try:
        await manager.notify_student(user_id, payload)
    except Exception:
        pass  # Student offline or WS error — notification is already saved in DB

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
