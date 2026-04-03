from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class OutletCreate(BaseModel):
    vendor_id: UUID
    name: str
    description: Optional[str] = None
    cuisine: Optional[str] = None
    upi_id: Optional[str] = None
    opening_time: str = "08:00"
    closing_time: str = "20:00"
    slot_duration_minutes: int = 15
    image_url: Optional[str] = None

class OutletUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cuisine: Optional[str] = None
    upi_id: Optional[str] = None
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    slot_duration_minutes: Optional[int] = None
    image_url: Optional[str] = None
    is_open: Optional[bool] = None

class OutletResponse(BaseModel):
    id: UUID
    vendor_id: UUID
    name: str
    description: Optional[str]
    cuisine: Optional[str]
    is_open: bool
    rating: float
    upi_id: Optional[str]
    opening_time: str
    closing_time: str
    slot_duration_minutes: int
    image_url: Optional[str]
    created_at: datetime

class TimeSlotResponse(BaseModel):
    time: str
    available_slots: int
    is_full: bool
