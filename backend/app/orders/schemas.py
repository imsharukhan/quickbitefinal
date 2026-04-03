from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class OrderItemInput(BaseModel):
    menu_item_id: str
    quantity: int = Field(..., ge=1)

class OrderCreate(BaseModel):
    outlet_id: str
    items: List[OrderItemInput] = Field(..., min_length=1)
    pickup_time: str
    total_price: float

class OrderItemResponse(BaseModel):
    name: str
    price: float
    quantity: int
    is_veg: bool

class OrderResponse(BaseModel):
    id: str
    outlet_id: UUID
    outlet_name: str
    outlet_upi_id: Optional[str]
    user_id: UUID
    student_name: str
    student_register_number: str
    status: str
    payment_status: str
    payment_confirmed_by_vendor: bool
    payment_gateway_id: Optional[str]
    total_price: float
    pickup_time: str
    token_number: int
    payment_method: str
    placed_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]
    upi_deep_link: str
    can_cancel: bool
    can_rate: bool

class StatusUpdate(BaseModel):
    status: str

class CancelOrder(BaseModel):
    reason: Optional[str] = None

class RateOrder(BaseModel):
    stars: int = Field(..., ge=1, le=5)
    review: Optional[str] = None

class PaymentConfirm(BaseModel):
    payment_gateway_id: Optional[str] = None
