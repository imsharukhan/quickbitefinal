from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    category: str
    is_veg: bool
    is_bestseller: bool = False
    image_url: Optional[str] = None
    daily_limit: Optional[int] = Field(None, gt=0)

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
    is_veg: Optional[bool] = None
    is_bestseller: Optional[bool] = None
    is_available: Optional[bool] = None
    image_url: Optional[str] = None
    daily_limit: Optional[int] = Field(None, ge=0)  # 0 = remove limit

class MenuItemResponse(BaseModel):
    id: UUID
    outlet_id: UUID
    name: str
    description: Optional[str]
    price: float
    category: str
    is_veg: bool
    is_available: bool
    is_bestseller: bool
    image_url: Optional[str]
    daily_limit: Optional[int] = None
    orders_today: int = 0  # computed — 0 default for toggle/update responses

    class Config:
        from_attributes = True