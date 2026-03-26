import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Float, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    outlet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("outlets.id"))
    status: Mapped[str] = mapped_column(String(50), default="Placed")
    total: Mapped[float] = mapped_column(Float)
    pickup_time: Mapped[str] = mapped_column(String(20))
    token_number: Mapped[int] = mapped_column(Integer)
    payment_method: Mapped[str] = mapped_column(String(50), default="upi")
    payment_status: Mapped[str] = mapped_column(String(50), default="pending")
    payment_confirmed_by_vendor: Mapped[bool] = mapped_column(Boolean, default=False)
    cancellation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    placed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"))
    menu_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_items.id"))
    name: Mapped[str] = mapped_column(String(100))
    price: Mapped[float] = mapped_column(Float)
    quantity: Mapped[int] = mapped_column(Integer)
    is_veg: Mapped[bool] = mapped_column(Boolean)

class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    outlet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("outlets.id"))
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), unique=True)
    stars: Mapped[int] = mapped_column(Integer)
    review: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
