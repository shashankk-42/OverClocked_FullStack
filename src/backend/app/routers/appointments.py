import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.auth.guards import get_current_user, require_role
from app.models.user import User
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.schemas.schemas import BookAppointmentRequest, AppointmentResponse, DoctorResponse
from app.services.appointment import (
    book_appointment, get_appointments_for_patient,
    get_appointments_for_doctor_today, check_in_patient,
    get_available_doctors, get_available_slots, get_queue_for_doctor
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("/doctors")
async def list_doctors(
    department: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if department:
        doctors = await get_available_doctors(db, department)
    else:
        result = await db.execute(select(Doctor))
        doctors = list(result.scalars().all())

    return [
        {
            "id": str(d.id),
            "name": d.name,
            "specialization": d.specialization,
            "department": d.department,
            "bio": d.bio,
            "available_days": d.available_days,
        }
        for d in doctors
    ]


@router.get("/slots/{doctor_id}")
async def get_slots(
    doctor_id: str,
    date: str,  # YYYY-MM-DD
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    slots = await get_available_slots(db, uuid.UUID(doctor_id), date_obj)
    return {"slots": slots}


@router.post("/book")
async def book(
    data: BookAppointmentRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    try:
        appointment = await book_appointment(
            db=db,
            patient_id=current_user.linked_id,
            doctor_id=uuid.UUID(data.doctor_id),
            scheduled_at=data.scheduled_at,
            chief_complaint=data.chief_complaint,
            priority=data.priority,
            triage_department=data.triage_department,
        )
        return {
            "id": str(appointment.id),
            "status": appointment.status,
            "scheduled_at": appointment.scheduled_at.isoformat(),
            "message": "Appointment booked successfully!",
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/my")
async def my_appointments(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    appointments = await get_appointments_for_patient(db, current_user.linked_id)

    result_list = []
    for a in appointments:
        # Get doctor name
        dr_result = await db.execute(select(Doctor).where(Doctor.id == a.doctor_id))
        doctor = dr_result.scalar_one_or_none()

        result_list.append({
            "id": str(a.id),
            "doctor_name": doctor.name if doctor else "Unknown",
            "department": doctor.department if doctor else "Unknown",
            "scheduled_at": a.scheduled_at.isoformat(),
            "status": a.status,
            "queue_position": a.queue_position,
            "chief_complaint": a.chief_complaint,
            "priority": a.priority,
        })
    return result_list


@router.get("/today")
async def today_appointments(
    current_user: User = Depends(require_role("doctor", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Doctor's today's appointments or all appointments for reception."""
    if current_user.role == "doctor":
        appointments = await get_appointments_for_doctor_today(db, current_user.linked_id)
    else:
        # Reception sees all
        from datetime import timezone, timedelta
        from sqlalchemy import and_
        from app.models.appointment import Appointment
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        result = await db.execute(
            select(Appointment).where(
                and_(
                    Appointment.scheduled_at >= today_start,
                    Appointment.scheduled_at < today_end,
                    Appointment.status != "cancelled",
                )
            ).order_by(Appointment.scheduled_at)
        )
        appointments = list(result.scalars().all())

    result_list = []
    for a in appointments:
        patient_result = await db.execute(select(Patient).where(Patient.id == a.patient_id))
        patient = patient_result.scalar_one_or_none()
        dr_result = await db.execute(select(Doctor).where(Doctor.id == a.doctor_id))
        doctor = dr_result.scalar_one_or_none()

        result_list.append({
            "id": str(a.id),
            "patient_id": str(a.patient_id),
            "doctor_id": str(a.doctor_id),
            "patient_name": patient.name if patient else "Unknown",
            "patient_pid": patient.pid if patient else "Unknown",
            "patient_phone": patient.phone if patient else "",
            "doctor_name": doctor.name if doctor else "Unknown",
            "department": doctor.department if doctor else "",
            "scheduled_at": a.scheduled_at.isoformat(),
            "status": a.status,
            "queue_position": a.queue_position,
            "chief_complaint": a.chief_complaint,
            "priority": a.priority,
        })
    return result_list


@router.post("/check-in/{appointment_id}")
async def check_in(
    appointment_id: str,
    current_user: User = Depends(require_role("receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        appointment = await check_in_patient(db, uuid.UUID(appointment_id))
        return {
            "id": str(appointment.id),
            "status": appointment.status,
            "queue_position": appointment.queue_position,
            "message": f"Patient checked in. Queue position: #{appointment.queue_position}",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/queue/{doctor_id}")
async def get_queue(
    doctor_id: str,
    current_user: User = Depends(require_role("doctor", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    appointments = await get_queue_for_doctor(db, uuid.UUID(doctor_id))
    result_list = []
    for a in appointments:
        patient_result = await db.execute(select(Patient).where(Patient.id == a.patient_id))
        patient = patient_result.scalar_one_or_none()
        result_list.append({
            "id": str(a.id),
            "patient_name": patient.name if patient else "Unknown",
            "patient_pid": patient.pid if patient else "Unknown",
            "queue_position": a.queue_position,
            "status": a.status,
            "chief_complaint": a.chief_complaint,
            "priority": a.priority,
        })
    return result_list


@router.patch("/{appointment_id}/status")
async def update_status(
    appointment_id: str,
    status: str,
    current_user: User = Depends(require_role("doctor", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.appointment import Appointment
    result = await db.execute(select(Appointment).where(Appointment.id == uuid.UUID(appointment_id)))
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "doctor" and appt.doctor_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    allowed = {"booked", "checked_in", "in_consultation", "completed", "cancelled"}
    if status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use one of: {', '.join(sorted(allowed))}")

    if status == "checked_in" and appt.status == "booked":
        appt = await check_in_patient(db, appt.id)
        return {
            "message": "Appointment accepted",
            "status": appt.status,
            "queue_position": appt.queue_position,
        }

    if status == "cancelled" and appt.status not in {"booked", "checked_in"}:
        raise HTTPException(status_code=400, detail=f"Cannot cancel appointment with status '{appt.status}'")

    appt.status = status
    await db.flush()
    return {"message": "Status updated", "status": status}
