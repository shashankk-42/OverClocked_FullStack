import uuid
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.auth.guards import require_role
from app.models.user import User
from app.models.doctor import Doctor
from app.models.enhancement import PharmacyOrder
from app.models.patient import Patient
from app.services.enhancements import notify, sync_medication_timeline_from_prescription
from app.schemas.schemas import CreatePrescriptionRequest, PrescriptionResponse
from app.services.consultation import (
    create_prescription, get_prescriptions_for_patient,
    get_prescription_by_id, get_patient_history_context
)
from app.ai.patient_summary import generate_patient_summary
from app.config import settings

router = APIRouter(prefix="/consultations", tags=["Consultations"])


@router.get("/patient/{patient_id}/summary")
async def get_patient_summary(
    patient_id: str,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """AI-generated patient summary for doctor."""
    context = await get_patient_history_context(db, uuid.UUID(patient_id))
    if not context:
        raise HTTPException(status_code=404, detail="Patient not found")

    summary = await generate_patient_summary(context)
    return {"summary": summary, "context": context}


@router.get("/patient/{patient_id}/history")
async def get_patient_history(
    patient_id: str,
    current_user: User = Depends(require_role("doctor", "admin", "patient")),
    db: AsyncSession = Depends(get_db),
):
    """Full patient history: appointments + prescriptions."""
    from app.models.appointment import Appointment
    from app.models.prescription import Prescription

    # Verify access: patients can only see their own
    if current_user.role == "patient":
        if str(current_user.linked_id) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied")

    patient_result = await db.execute(select(Patient).where(Patient.id == uuid.UUID(patient_id)))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Appointments
    appt_result = await db.execute(
        select(Appointment).where(Appointment.patient_id == uuid.UUID(patient_id))
        .order_by(Appointment.scheduled_at.desc())
    )
    appointments = appt_result.scalars().all()

    appt_list = []
    for a in appointments:
        dr_result = await db.execute(select(Doctor).where(Doctor.id == a.doctor_id))
        doctor = dr_result.scalar_one_or_none()
        appt_list.append({
            "id": str(a.id),
            "doctor_name": doctor.name if doctor else "Unknown",
            "department": doctor.department if doctor else "",
            "scheduled_at": a.scheduled_at.isoformat(),
            "status": a.status,
            "chief_complaint": a.chief_complaint,
        })

    # Prescriptions
    prescriptions = await get_prescriptions_for_patient(db, uuid.UUID(patient_id))
    rx_list = []
    for rx in prescriptions:
        dr_result = await db.execute(select(Doctor).where(Doctor.id == rx.doctor_id))
        doctor = dr_result.scalar_one_or_none()
        rx_list.append({
            "id": str(rx.id),
            "doctor_name": doctor.name if doctor else "Unknown",
            "diagnosis": rx.diagnosis,
            "medicines": rx.medicines,
            "soap_notes": rx.soap_notes,
            "status": rx.status,
            "pdf_url": f"/uploads/{rx.pdf_path}" if rx.pdf_path else None,
            "created_at": rx.created_at.isoformat(),
        })

    return {
        "patient": {
            "id": str(patient.id),
            "pid": patient.pid,
            "name": patient.name,
            "gender": patient.gender,
            "blood_group": patient.blood_group,
            "allergies": patient.allergies,
        },
        "appointments": appt_list,
        "prescriptions": rx_list,
    }


@router.post("/prescription", status_code=201)
async def create_prescription_route(
    data: CreatePrescriptionRequest,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    try:
        if not data.diagnosis.strip():
            raise ValueError("Diagnosis is required before finishing a prescription")
        if not data.medicines:
            raise ValueError("At least one medicine is required before finishing a prescription")
        for index, medicine in enumerate(data.medicines, start=1):
            if not medicine.name.strip() or not medicine.dosage.strip() or not medicine.frequency.strip() or not medicine.duration.strip():
                raise ValueError(f"Medicine #{index} is incomplete")

        medicines = [m.model_dump() for m in data.medicines]
        prescription = await create_prescription(
            db=db,
            patient_id=uuid.UUID(data.patient_id),
            doctor_id=current_user.linked_id,
            appointment_id=uuid.UUID(data.appointment_id) if data.appointment_id else None,
            diagnosis=data.diagnosis,
            medicines=medicines,
            soap_notes=data.soap_notes,
            drug_interactions=data.drug_interactions,
        )
        prescription.status = "sent_to_patient"

        existing_order_result = await db.execute(
            select(PharmacyOrder).where(PharmacyOrder.prescription_id == prescription.id)
        )
        order = existing_order_result.scalar_one_or_none()
        if not order:
            order = PharmacyOrder(
                prescription_id=prescription.id,
                patient_id=prescription.patient_id,
                status="patient_review",
            )
            db.add(order)
            await db.flush()

        await sync_medication_timeline_from_prescription(db, prescription)
        await notify(
            db,
            title="Prescription ready for review",
            message="Your doctor finalized a prescription. Review and approve medicines to send it to pharmacy.",
            notification_type="prescription",
            patient_id=prescription.patient_id,
            priority="high",
            payload={"prescription_id": str(prescription.id), "order_id": str(order.id)},
        )
        return {
            "id": str(prescription.id),
            "pharmacy_order_id": str(order.id),
            "status": prescription.status,
            "pdf_url": f"/uploads/{prescription.pdf_path}" if prescription.pdf_path else None,
            "message": "Prescription finalized and sent to patient for pharmacy approval",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/prescriptions")
async def list_prescriptions(
    current_user: User = Depends(require_role("doctor", "pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """List prescriptions for the current doctor or operations staff."""
    from app.models.prescription import Prescription

    query = select(Prescription).order_by(Prescription.created_at.desc())
    if current_user.role == "doctor":
        query = query.where(Prescription.doctor_id == current_user.linked_id)

    result = await db.execute(query)
    prescriptions = result.scalars().all()

    rows = []
    for rx in prescriptions:
        patient_result = await db.execute(select(Patient).where(Patient.id == rx.patient_id))
        patient = patient_result.scalar_one_or_none()
        dr_result = await db.execute(select(Doctor).where(Doctor.id == rx.doctor_id))
        doctor = dr_result.scalar_one_or_none()
        rows.append({
            "id": str(rx.id),
            "patient_id": str(rx.patient_id),
            "patient_name": patient.name if patient else "Unknown",
            "patient_pid": patient.pid if patient else "",
            "doctor_name": doctor.name if doctor else "Unknown",
            "diagnosis": rx.diagnosis,
            "medicines": rx.medicines or [],
            "status": rx.status,
            "pdf_url": f"/uploads/{rx.pdf_path}" if rx.pdf_path else None,
            "created_at": rx.created_at.isoformat(),
        })
    return rows


@router.get("/prescription/{prescription_id}")
async def get_prescription(
    prescription_id: str,
    current_user: User = Depends(require_role("doctor", "pharmacist", "admin", "patient")),
    db: AsyncSession = Depends(get_db),
):
    prescription = await get_prescription_by_id(db, uuid.UUID(prescription_id))
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    patient_result = await db.execute(select(Patient).where(Patient.id == prescription.patient_id))
    patient = patient_result.scalar_one_or_none()
    dr_result = await db.execute(select(Doctor).where(Doctor.id == prescription.doctor_id))
    doctor = dr_result.scalar_one_or_none()

    return {
        "id": str(prescription.id),
        "patient_name": patient.name if patient else "Unknown",
        "patient_pid": patient.pid if patient else "",
        "patient_allergies": patient.allergies if patient else "",
        "doctor_name": doctor.name if doctor else "Unknown",
        "diagnosis": prescription.diagnosis,
        "medicines": prescription.medicines,
        "soap_notes": prescription.soap_notes,
        "status": prescription.status,
        "drug_interactions": prescription.drug_interactions,
        "pdf_url": f"/uploads/{prescription.pdf_path}" if prescription.pdf_path else None,
        "created_at": prescription.created_at.isoformat(),
    }


@router.get("/prescription/{prescription_id}/pdf")
async def download_prescription_pdf(
    prescription_id: str,
    current_user: User = Depends(require_role("doctor", "pharmacist", "admin", "patient")),
    db: AsyncSession = Depends(get_db),
):
    prescription = await get_prescription_by_id(db, uuid.UUID(prescription_id))
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if current_user.role == "patient" and current_user.linked_id != prescription.patient_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "doctor" and current_user.linked_id != prescription.doctor_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if not prescription.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not generated for this prescription")

    abs_path = os.path.join(settings.uploads_dir, prescription.pdf_path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="PDF file missing on server")

    return FileResponse(
        abs_path,
        media_type="application/pdf",
        filename=f"prescription-{prescription_id[:8]}.pdf",
    )
