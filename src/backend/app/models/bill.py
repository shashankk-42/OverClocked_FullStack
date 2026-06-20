import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.session import Base


class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    prescription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("prescriptions.id"), nullable=True)
    items: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # [{"medicine_name": "Metformin", "quantity": 30, "unit_price": 5.0, "total": 150.0}]
    subtotal: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    tax: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0)
    payment_status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending | paid | cancelled
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    razorpay_order_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
