import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.user import User
from app.services.enhancements import notify


async def _patient_user(db: AsyncSession, patient_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User).where(User.role == "patient", User.linked_id == patient_id)
    )
    return result.scalar_one_or_none()


async def _doctor_user(db: AsyncSession, doctor_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User).where(User.role == "doctor", User.linked_id == doctor_id)
    )
    return result.scalar_one_or_none()


async def notify_appointment_status_change(
    db: AsyncSession,
    appointment: Appointment,
    old_status: str,
    new_status: str,
    actor_role: str | None = None,
) -> None:
    if old_status == new_status:
        return

    patient_result = await db.execute(select(Patient).where(Patient.id == appointment.patient_id))
    patient = patient_result.scalar_one_or_none()
    doctor_result = await db.execute(select(Doctor).where(Doctor.id == appointment.doctor_id))
    doctor = doctor_result.scalar_one_or_none()
    patient_user = await _patient_user(db, appointment.patient_id)
    doctor_user = await _doctor_user(db, appointment.doctor_id)

    time_str = appointment.scheduled_at.strftime("%d %b %Y at %I:%M %p UTC")
    patient_name = patient.name if patient else "Patient"
    doctor_name = doctor.name if doctor else "your doctor"

    if new_status == "checked_in" and old_status == "booked":
        await notify(
            db,
            title="Appointment approved",
            message=f"Your visit with {doctor_name} on {time_str} has been approved. Please arrive 10 minutes early.",
            notification_type="appointment",
            user_id=patient_user.id if patient_user else None,
            patient_id=appointment.patient_id,
            priority="high",
            payload={"appointment_id": str(appointment.id), "status": new_status},
        )
        await notify(
            db,
            title="Patient appointment approved",
            message=f"{patient_name} is confirmed for {time_str}. They will appear in your queue.",
            notification_type="appointment",
            user_id=doctor_user.id if doctor_user else None,
            role="doctor",
            patient_id=appointment.patient_id,
            priority="normal",
            payload={"appointment_id": str(appointment.id), "status": new_status},
        )
        if actor_role == "receptionist":
            await notify(
                db,
                title="Reception approved booking",
                message=f"You approved {patient_name}'s appointment with {doctor_name}.",
                notification_type="appointment",
                role="receptionist",
                patient_id=appointment.patient_id,
                priority="normal",
                payload={"appointment_id": str(appointment.id)},
            )

    elif new_status == "waiting" and old_status in {"booked", "checked_in", "late"}:
        await notify(
            db,
            title="Checked in at reception",
            message=f"You are checked in for your appointment with {doctor_name}. Please wait in the lobby.",
            notification_type="appointment",
            user_id=patient_user.id if patient_user else None,
            patient_id=appointment.patient_id,
            priority="high",
            payload={"appointment_id": str(appointment.id), "status": new_status},
        )
        await notify(
            db,
            title="Patient checked in",
            message=f"{patient_name} has checked in and is waiting for {time_str}.",
            notification_type="appointment",
            user_id=doctor_user.id if doctor_user else None,
            role="doctor",
            patient_id=appointment.patient_id,
            priority="normal",
            payload={"appointment_id": str(appointment.id), "status": new_status},
        )

    elif new_status == "cancelled":
        await notify(
            db,
            title="Appointment declined",
            message=f"Your appointment with {doctor_name} on {time_str} was declined. Please book another slot.",
            notification_type="appointment",
            user_id=patient_user.id if patient_user else None,
            patient_id=appointment.patient_id,
            priority="high",
            payload={"appointment_id": str(appointment.id), "status": new_status},
        )
        if doctor_user:
            await notify(
                db,
                title="Appointment cancelled",
                message=f"The appointment with {patient_name} on {time_str} was cancelled.",
                notification_type="appointment",
                user_id=doctor_user.id,
                role="doctor",
                patient_id=appointment.patient_id,
                priority="normal",
                payload={"appointment_id": str(appointment.id), "status": new_status},
            )

    elif new_status == "in_consultation":
        await notify(
            db,
            title="Consultation started",
            message=f"Your consultation with {doctor_name} has started.",
            notification_type="appointment",
            user_id=patient_user.id if patient_user else None,
            patient_id=appointment.patient_id,
            priority="normal",
            payload={"appointment_id": str(appointment.id), "status": new_status},
        )
