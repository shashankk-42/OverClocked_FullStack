import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.prescription import Prescription
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.report import Report
from app.services.prescription_pdf import generate_prescription_pdf
from app.services.billing import create_consultation_bill, send_payment_link_notification


async def get_patient_history_context(db: AsyncSession, patient_id: uuid.UUID) -> dict:
    """Gather all patient data for AI context."""
    # Get patient
    patient_result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        return {}

    # Calculate age
    age = "Unknown"
    if patient.dob:
        today = datetime.now(timezone.utc).date()
        age = str(today.year - patient.dob.year)

    # Get prescriptions (last 5)
    rx_result = await db.execute(
        select(Prescription)
        .where(Prescription.patient_id == patient_id)
        .order_by(Prescription.created_at.desc())
        .limit(5)
    )
    prescriptions = rx_result.scalars().all()

    # Get appointments (last 10)
    appt_result = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .order_by(Appointment.scheduled_at.desc())
        .limit(10)
    )
    appointments = appt_result.scalars().all()

    # Get reports (last 5)
    report_result = await db.execute(
        select(Report)
        .where(Report.patient_id == patient_id)
        .order_by(Report.created_at.desc())
        .limit(5)
    )
    reports = report_result.scalars().all()

    # Format prescriptions
    rx_text = "\n".join([
        f"- {rx.created_at.strftime('%Y-%m-%d')}: {rx.diagnosis or 'No diagnosis'} — medicines: {rx.medicines or []}"
        for rx in prescriptions
    ])

    # Format appointments
    appt_text = "\n".join([
        f"- {a.scheduled_at.strftime('%Y-%m-%d')}: {a.chief_complaint or 'General visit'} ({a.status})"
        for a in appointments
    ])

    # Get current medications from latest prescription
    current_meds = []
    if prescriptions and prescriptions[0].medicines:
        current_meds = [m.get("name", "") for m in prescriptions[0].medicines]

    return {
        "name": patient.name,
        "age": age,
        "gender": patient.gender or "Unknown",
        "blood_group": patient.blood_group or "Unknown",
        "allergies": patient.allergies or "None reported",
        "visit_history": appt_text or "No previous visits",
        "prescriptions": rx_text or "No prescriptions",
        "reports": "\n".join([f"- {r.report_type}: {r.summary or 'Not analyzed'}" for r in reports]) or "None",
        "current_medications": ", ".join(current_meds) if current_meds else "None",
        "conditions": "Based on visit history above",
    }


async def create_prescription(
    db: AsyncSession,
    patient_id: uuid.UUID,
    doctor_id: uuid.UUID,
    appointment_id: uuid.UUID | None,
    diagnosis: str,
    medicines: list[dict],
    soap_notes: dict | None = None,
    drug_interactions: list | None = None,
) -> Prescription:
    prescription = Prescription(
        patient_id=patient_id,
        doctor_id=doctor_id,
        appointment_id=appointment_id,
        diagnosis=diagnosis,
        medicines=medicines,
        soap_notes=soap_notes,
        drug_interactions=drug_interactions,
        status="pending",
    )
    db.add(prescription)
    await db.flush()

    patient_result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = patient_result.scalar_one_or_none()
    doctor_result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = doctor_result.scalar_one_or_none()

    if patient and doctor:
        try:
            pdf_path = generate_prescription_pdf(
                prescription_id=prescription.id,
                patient={"name": patient.name, "pid": patient.pid},
                doctor={
                    "name": doctor.name,
                    "department": doctor.department,
                    "specialization": doctor.specialization,
                },
                diagnosis=diagnosis,
                medicines=medicines,
                soap_notes=soap_notes,
            )
            prescription.pdf_path = pdf_path
        except Exception:
            pass

    # Update appointment status if exists
    appt = None
    if appointment_id:
        appt_result = await db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        appt = appt_result.scalar_one_or_none()
        if appt:
            appt.status = "completed"

    bill = await create_consultation_bill(
        db=db,
        patient_id=patient_id,
        appointment_id=appointment_id,
        prescription_id=prescription.id,
    )
    await send_payment_link_notification(
        db,
        bill,
        doctor.name if doctor else None,
    )

    return prescription


async def get_prescriptions_for_patient(db: AsyncSession, patient_id: uuid.UUID) -> list[Prescription]:
    result = await db.execute(
        select(Prescription)
        .where(Prescription.patient_id == patient_id)
        .order_by(Prescription.created_at.desc())
    )
    return list(result.scalars().all())


async def get_prescription_by_id(db: AsyncSession, prescription_id: uuid.UUID) -> Prescription | None:
    result = await db.execute(
        select(Prescription).where(Prescription.id == prescription_id)
    )
    return result.scalar_one_or_none()
