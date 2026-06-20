import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.session import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    medicines: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # [{"name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "duration": "30 days", "instructions": "after food"}]
    soap_notes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {"subjective": "", "objective": "", "assessment": "", "plan": ""}
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # pending | dispensed | cancelled
    drug_interactions: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
