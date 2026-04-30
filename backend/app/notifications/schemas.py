from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    message: str
    is_read: bool
    related_order_id: Optional[str]
    created_at: datetime

class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
