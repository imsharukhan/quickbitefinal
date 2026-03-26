import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Float, DateTime, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Outlet(Base):
    __tablename__ = "outlets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cuisine: Mapped[str | None] = mapped_column(String(100), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    upi_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    opening_time: Mapped[str] = mapped_column(String(5), default="08:00")
    closing_time: Mapped[str] = mapped_column(String(5), default="20:00")
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=15)
    max_orders_per_slot: Mapped[int] = mapped_column(Integer, default=15)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
