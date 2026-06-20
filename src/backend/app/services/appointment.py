import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient

ACTIVE_SLOT_STATUSES = {"booked", "checked_in", "waiting", "in_consultation", "late"}
QUEUE_STATUSES = {"checked_in", "waiting", "in_consultation"}


async def get_available_doctors(db: AsyncSession, department: str) -> list[Doctor]:
    result = await db.execute(
        select(Doctor).where(Doctor.department.ilike(f"%{department}%"))
    )
    return list(result.scalars().all())


async def get_available_slots(db: AsyncSession, doctor_id: uuid.UUID, date: datetime) -> list[str]:
    """Get available 30-minute slots for a doctor on a given date."""
    day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = date.replace(hour=23, minute=59, second=59)

    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.scheduled_at >= day_start,
                Appointment.scheduled_at <= day_end,
                Appointment.status.in_(list(ACTIVE_SLOT_STATUSES | {"completed"})),
            )
        )
    )
    booked_times = {appointment.scheduled_at.strftime("%H:%M") for appointment in result.scalars().all()}

    slots = []
    current = date.replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = date.replace(hour=17, minute=0, second=0, microsecond=0)

    now = datetime.now(timezone.utc)
    while current < end_time:
        current_aware = current if current.tzinfo else current.replace(tzinfo=timezone.utc)
        slot_str = current.strftime("%H:%M")
        if slot_str not in booked_times and current_aware > now:
            slots.append(current_aware.isoformat())
        current += timedelta(minutes=30)

    return slots


async def book_appointment(
    db: AsyncSession,
    patient_id: uuid.UUID,
    doctor_id: uuid.UUID,
    scheduled_at: datetime,
    chief_complaint: str | None = None,
    priority: str = "medium",
    triage_department: str | None = None,
) -> Appointment:
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)

    if scheduled_at < datetime.now(timezone.utc):
        raise ValueError("Cannot book an appointment in the past.")

    doctor_result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    if not doctor_result.scalar_one_or_none():
        raise ValueError("Doctor not found.")

    patient_result = await db.execute(select(Patient).where(Patient.id == patient_id))
    if not patient_result.scalar_one_or_none():
        raise ValueError("Patient not found.")

    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.scheduled_at == scheduled_at,
                Appointment.status.in_(list(ACTIVE_SLOT_STATUSES | {"completed"})),
            )
        )
    )
    if result.scalar_one_or_none():
        raise ValueError("This slot is already booked. Please choose another time.")

    appointment = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        scheduled_at=scheduled_at,
        chief_complaint=chief_complaint,
        priority=priority,
        triage_department=triage_department,
        status="booked",
    )
    db.add(appointment)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise ValueError("This slot is already booked. Please choose another time.") from exc
    return appointment


async def get_appointments_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> list[Appointment]:
    result = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(Appointment.scheduled_at.desc())
    )
    return list(result.scalars().all())


async def get_appointments_for_doctor_today(db: AsyncSession, doctor_id: uuid.UUID) -> list[Appointment]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.scheduled_at >= today_start,
                Appointment.scheduled_at < today_end,
                Appointment.status != "cancelled",
            )
        ).order_by(Appointment.queue_position.nullsfirst(), Appointment.scheduled_at)
    )
    return list(result.scalars().all())


async def get_pending_approval_appointments(
    db: AsyncSession,
    doctor_id: uuid.UUID | None = None,
) -> list[Appointment]:
    """Booked appointments from start of today UTC onward (includes future days)."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    query = select(Appointment).where(
        Appointment.status == "booked",
        Appointment.scheduled_at >= today_start,
    )
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    query = query.order_by(Appointment.scheduled_at)
    result = await db.execute(query)
    return list(result.scalars().all())


async def _next_queue_position(db: AsyncSession, doctor_id: uuid.UUID) -> int:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.scheduled_at >= today_start,
                Appointment.scheduled_at < today_end,
                Appointment.status.in_(list(QUEUE_STATUSES)),
            )
        )
    )
    positions = [appointment.queue_position or 0 for appointment in result.scalars().all()]
    return (max(positions) if positions else 0) + 1


async def check_in_patient(
    db: AsyncSession,
    appointment_id: uuid.UUID,
    target_status: str = "waiting",
) -> Appointment:
    result = await db.execute(select(Appointment).where(Appointment.id == appointment_id))
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")
    if appointment.status not in {"booked", "late", "checked_in"}:
        raise ValueError(f"Cannot check in - appointment status is '{appointment.status}'")
    if target_status not in {"checked_in", "waiting"}:
        raise ValueError("Check-in target must be checked_in or waiting")

    if appointment.queue_position is None:
        appointment.queue_position = await _next_queue_position(db, appointment.doctor_id)

    appointment.status = target_status
    await db.flush()
    return appointment


async def update_appointment_state(db: AsyncSession, appointment: Appointment, status: str) -> Appointment:
    transitions = {
        "booked": {"checked_in", "waiting", "late", "absent", "cancelled"},
        "late": {"checked_in", "waiting", "absent", "cancelled"},
        "checked_in": {"waiting", "in_consultation", "absent", "cancelled"},
        "waiting": {"in_consultation", "absent", "cancelled"},
        "in_consultation": {"completed"},
        "completed": set(),
        "cancelled": set(),
        "absent": {"cancelled"},
    }
    allowed_statuses = set(transitions.keys())
    if status not in allowed_statuses:
        raise ValueError(f"Invalid status. Use one of: {', '.join(sorted(allowed_statuses))}")
    if status == appointment.status:
        return appointment
    if status not in transitions.get(appointment.status, set()):
        raise ValueError(f"Cannot move appointment from '{appointment.status}' to '{status}'")

    if status in {"checked_in", "waiting"}:
        return await check_in_patient(db, appointment.id, target_status=status)

    if status == "in_consultation" and appointment.queue_position is None:
        appointment.queue_position = await _next_queue_position(db, appointment.doctor_id)

    if status in {"cancelled", "absent", "completed"}:
        appointment.queue_position = None

    appointment.status = status
    await db.flush()
    return appointment


async def get_queue_for_doctor(db: AsyncSession, doctor_id: uuid.UUID) -> list[Appointment]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.scheduled_at >= today_start,
                Appointment.scheduled_at < today_end,
                Appointment.status.in_(list(QUEUE_STATUSES)),
            )
        ).order_by(Appointment.queue_position)
    )
    return list(result.scalars().all())
