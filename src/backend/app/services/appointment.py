import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient


async def get_available_doctors(db: AsyncSession, department: str) -> list[Doctor]:
    result = await db.execute(
        select(Doctor).where(Doctor.department.ilike(f"%{department}%"))
    )
    return list(result.scalars().all())


async def get_available_slots(db: AsyncSession, doctor_id: uuid.UUID, date: datetime) -> list[str]:
    """Get available 30-min slots for a doctor on a given date."""
    # Get all booked slots for that doctor on that date
    day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = date.replace(hour=23, minute=59, second=59)

    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.scheduled_at >= day_start,
                Appointment.scheduled_at <= day_end,
                Appointment.status != "cancelled",
            )
        )
    )
    booked = result.scalars().all()
    booked_times = {a.scheduled_at.strftime("%H:%M") for a in booked}

    # Generate slots 9am - 5pm
    slots = []
    current = date.replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = date.replace(hour=17, minute=0, second=0, microsecond=0)

    while current < end_time:
        slot_str = current.strftime("%H:%M")
        if slot_str not in booked_times:
            slots.append(current.isoformat())
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
    # Check for conflicts (SELECT FOR UPDATE would be ideal — using check here for MVP)
    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == doctor_id,
                Appointment.scheduled_at == scheduled_at,
                Appointment.status != "cancelled",
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
    await db.flush()
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


async def check_in_patient(db: AsyncSession, appointment_id: uuid.UUID) -> Appointment:
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise ValueError("Appointment not found")
    if appointment.status != "booked":
        raise ValueError(f"Cannot check in — appointment status is '{appointment.status}'")

    # Assign queue position
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == appointment.doctor_id,
                Appointment.scheduled_at >= today_start,
                Appointment.scheduled_at < today_end,
                Appointment.status == "checked_in",
            )
        )
    )
    checked_in_count = len(result.scalars().all())

    appointment.status = "checked_in"
    appointment.queue_position = checked_in_count + 1
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
                Appointment.status.in_(["checked_in", "in_consultation"]),
            )
        ).order_by(Appointment.queue_position)
    )
    return list(result.scalars().all())
