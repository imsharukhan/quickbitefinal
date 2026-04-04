import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    business_name: Mapped[str] = mapped_column(String(100))
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True)

    user = relationship("User", back_populates="vendor_profile")
