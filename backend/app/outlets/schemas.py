from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, model_validator, ConfigDict
import pytz

IST = pytz.timezone('Asia/Kolkata')

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
    closed_dates: Optional[list] = None

class OutletResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
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
    closed_dates: Optional[list] = []

    @model_validator(mode='after')
    def sync_ist_time(self):
        try:
            now_ist = datetime.now(IST)
            today_str = now_ist.strftime("%Y-%m-%d")

            # Check holiday/closed dates first
            if self.closed_dates and today_str in self.closed_dates:
                self.is_open = False
                return self

            # Check operating hours
            if self.is_open and self.opening_time and self.closing_time:
                now_str = now_ist.strftime("%H:%M")
                if not (self.opening_time <= now_str <= self.closing_time):
                    self.is_open = False
        except Exception:
            pass
        return self

class TimeSlotResponse(BaseModel):
    time: str
    available_slots: int
    is_full: bool
