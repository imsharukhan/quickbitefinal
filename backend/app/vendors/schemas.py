from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class VendorCreate(BaseModel):
    business_name: str
    email: Optional[str] = None
    phone: str
    initial_password: str

class VendorUpdate(BaseModel):
    business_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_name: str
    phone: str
    is_active: bool
    must_change_password: bool
    created_at: datetime
