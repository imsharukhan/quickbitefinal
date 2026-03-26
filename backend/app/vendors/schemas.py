from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class VendorCreate(BaseModel):
    name: str
    phone: str
    initial_password: str

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

class VendorResponse(BaseModel):
    id: UUID
    name: str
    phone: str
    is_active: bool
    must_change_password: bool
    created_at: datetime
