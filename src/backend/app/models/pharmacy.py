import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base


class PharmacyItem(Base):
    __tablename__ = "pharmacy_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medicine_name: Mapped[str] = mapped_column(String(255), index=True)
    generic_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(50), default="tablets")
    price_per_unit: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=20)
    manufacturer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
