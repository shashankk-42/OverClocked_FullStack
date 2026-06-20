import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.enhancement import (
    AppointmentWaitPrediction,
    AuditLog,
    DomainEvent,
    MedicationCostAnalysis,
    MedicationTimelineItem,
    Notification,
)
from app.models.pharmacy import PharmacyItem
from app.models.prescription import Prescription
from app.models.user import User


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def to_jsonable(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def model_to_dict(model: Any) -> dict[str, Any]:
    return {
        column.name: to_jsonable(getattr(model, column.name))
        for column in model.__table__.columns
    }


async def audit_action(
    db: AsyncSession,
    user: User | None,
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    patient_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user.id if user else None,
        role=user.role if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        patient_id=patient_id,
        metadata_json=metadata or {},
    )
    db.add(log)
    return log


async def publish_event(
    db: AsyncSession,
    event_type: str,
    aggregate_type: str,
    aggregate_id: str,
    patient_id: uuid.UUID | None = None,
    payload: dict | None = None,
) -> DomainEvent:
    event = DomainEvent(
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_id=aggregate_id,
        patient_id=patient_id,
        payload=payload or {},
    )
    db.add(event)
    return event


async def notify(
    db: AsyncSession,
    title: str,
    message: str,
    notification_type: str,
    user_id: uuid.UUID | None = None,
    role: str | None = None,
    patient_id: uuid.UUID | None = None,
    priority: str = "normal",
    payload: dict | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        role=role,
        patient_id=patient_id,
        title=title,
        message=message,
        notification_type=notification_type,
        priority=priority,
        payload=payload or {},
    )
    db.add(notification)
    return notification


async def sync_medication_timeline_from_prescription(
    db: AsyncSession,
    prescription: Prescription,
) -> list[MedicationTimelineItem]:
    existing = await db.execute(
        select(MedicationTimelineItem).where(MedicationTimelineItem.prescription_id == prescription.id)
    )
    current_items = list(existing.scalars().all())
    if current_items:
        return current_items

    items: list[MedicationTimelineItem] = []
    for medicine in prescription.medicines or []:
        item = MedicationTimelineItem(
            patient_id=prescription.patient_id,
            prescription_id=prescription.id,
            doctor_id=prescription.doctor_id,
            medicine_name=medicine.get("name", "Unknown medicine"),
            dosage=medicine.get("dosage"),
            frequency=medicine.get("frequency"),
            status="active" if prescription.status != "cancelled" else "completed",
            dispenser_ready=True,
            metadata_json=medicine,
        )
        db.add(item)
        items.append(item)
    return items


async def calculate_prescription_cost(
    db: AsyncSession,
    prescription: Prescription,
) -> MedicationCostAnalysis:
    existing = await db.execute(
        select(MedicationCostAnalysis).where(MedicationCostAnalysis.prescription_id == prescription.id)
    )
    current = existing.scalar_one_or_none()
    if current:
        return current

    cost_breakdown = []
    alternatives = []
    total = 0.0

    for medicine in prescription.medicines or []:
        name = medicine.get("name", "")
        quantity = int(medicine.get("quantity", 10) or 10)
        result = await db.execute(select(PharmacyItem).where(PharmacyItem.medicine_name.ilike(f"%{name}%")))
        item = result.scalar_one_or_none()
        unit_price = float(item.price_per_unit) if item else 0.0
        line_total = round(unit_price * quantity, 2)
        total += line_total
        cost_breakdown.append(
            {
                "medicine_name": name,
                "quantity": quantity,
                "unit_price": unit_price,
                "total": line_total,
                "matched_inventory": bool(item),
            }
        )

        if item and item.generic_name:
            generic_result = await db.execute(
                select(PharmacyItem).where(
                    and_(
                        PharmacyItem.generic_name.ilike(f"%{item.generic_name}%"),
                        PharmacyItem.medicine_name != item.medicine_name,
                    )
                )
            )
            for alt in generic_result.scalars().all()[:5]:
                alternatives.append(
                    {
                        "original": item.medicine_name,
                        "alternative": alt.medicine_name,
                        "generic_name": alt.generic_name,
                        "unit_price": float(alt.price_per_unit),
                    }
                )

    analysis = MedicationCostAnalysis(
        prescription_id=prescription.id,
        patient_id=prescription.patient_id,
        cost_breakdown=cost_breakdown,
        total_cost=round(total, 2),
        generic_alternatives=alternatives,
    )
    db.add(analysis)
    return analysis


async def predict_wait_time(
    db: AsyncSession,
    appointment: Appointment,
) -> AppointmentWaitPrediction:
    queue_position = appointment.queue_position or 0
    active_queue = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == appointment.doctor_id,
                Appointment.status.in_(["checked_in", "waiting", "in_consultation"]),
            )
        )
    )
    queue_count = len(list(active_queue.scalars().all()))

    doctor_result = await db.execute(select(Doctor).where(Doctor.id == appointment.doctor_id))
    doctor = doctor_result.scalar_one_or_none()
    slot_minutes = doctor.slot_duration_minutes if doctor else 30

    priority_factor = 0
    if appointment.priority in ("high", "emergency"):
        priority_factor = -min(slot_minutes, queue_count * 5)

    estimated_wait = max(0, ((queue_position or queue_count) * slot_minutes) + priority_factor)
    confidence = 0.65 if queue_count else 0.45

    prediction = AppointmentWaitPrediction(
        appointment_id=appointment.id,
        estimated_wait_minutes=estimated_wait,
        queue_position=appointment.queue_position,
        confidence_score=confidence,
        factors={
            "queue_length": queue_count,
            "slot_duration_minutes": slot_minutes,
            "priority": appointment.priority,
            "emergency_interruptions": "included when active emergency events are wired to queue policy",
        },
    )
    db.add(prediction)
    return prediction
