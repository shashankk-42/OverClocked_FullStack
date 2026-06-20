import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.auth.guards import get_current_user, require_role
from app.models.user import User
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.schemas.schemas import (
    TriageRequest, SOAPRequest, PrescriptionGenRequest,
    AltMedicineRequest, ChatRequest, RxExplainRequest, DrugInteractionRequest
)
from app.ai.triage import triage_symptoms
from app.ai.soap_notes import generate_soap_notes
from app.ai.prescription_gen import generate_prescription, check_drug_interactions
from app.ai.alt_medicine import suggest_alternatives, explain_prescription, ai_chat_response, offline_chat_response
from app.services.consultation import get_patient_history_context

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/triage")
async def triage(
    data: TriageRequest,
    current_user: User = Depends(get_current_user),
):
    result = await triage_symptoms(data.symptoms)
    return result


@router.post("/soap-notes")
async def soap_notes(
    data: SOAPRequest,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    # Get patient context
    context = await get_patient_history_context(db, uuid.UUID(data.patient_id))
    patient_context = {
        "age": context.get("age", "Unknown"),
        "gender": context.get("gender", "Unknown"),
        "chief_complaint": context.get("chief_complaint", "Not specified"),
        "conditions": context.get("conditions", "None"),
    }
    notes = await generate_soap_notes(data.transcript, patient_context)
    return notes


@router.post("/prescription/generate")
async def generate_rx(
    data: PrescriptionGenRequest,
    current_user: User = Depends(require_role("doctor")),
    db: AsyncSession = Depends(get_db),
):
    context = await get_patient_history_context(db, uuid.UUID(data.patient_id))
    medicines = await generate_prescription(data.diagnosis, context)
    return {"medicines": medicines, "source": "ai" if medicines else "offline"}


@router.post("/drug-interaction")
async def drug_interaction(
    data: DrugInteractionRequest,
    current_user: User = Depends(require_role("doctor", "pharmacist")),
    db: AsyncSession = Depends(get_db),
):
    allergies = ""
    current_meds: list[str] = []

    if data.patient_id:
        result = await db.execute(select(Patient).where(Patient.id == uuid.UUID(data.patient_id)))
        patient = result.scalar_one_or_none()
        if patient:
            allergies = patient.allergies or ""

        # Fetch latest prescription to get current medications
        from app.models.prescription import Prescription
        from sqlalchemy import desc
        rx_result = await db.execute(
            select(Prescription)
            .where(Prescription.patient_id == uuid.UUID(data.patient_id))
            .order_by(desc(Prescription.created_at))
            .limit(1)
        )
        latest_rx = rx_result.scalar_one_or_none()
        if latest_rx and latest_rx.medicines:
            current_meds = [m.get("name", "") for m in latest_rx.medicines if m.get("name")]

    result = await check_drug_interactions(data.medicines, allergies, current_meds)
    return result


@router.post("/alt-medicine")
async def alt_medicine(
    data: AltMedicineRequest,
    current_user: User = Depends(require_role("pharmacist", "doctor")),
    db: AsyncSession = Depends(get_db),
):
    allergies = ""
    if data.patient_id:
        result = await db.execute(select(Patient).where(Patient.id == uuid.UUID(data.patient_id)))
        patient = result.scalar_one_or_none()
        if patient:
            allergies = patient.allergies or ""

    alternatives = await suggest_alternatives(data.medicine_name, data.diagnosis, allergies)
    return {"alternatives": alternatives}


@router.post("/explain-rx/{prescription_id}")
async def explain_rx(
    prescription_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Prescription).where(Prescription.id == uuid.UUID(prescription_id)))
    prescription = result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    # Get patient name
    patient_result = await db.execute(select(Patient).where(Patient.id == prescription.patient_id))
    patient = patient_result.scalar_one_or_none()

    explanation = await explain_prescription(
        prescription.medicines or [],
        patient.name if patient else "Patient"
    )
    return {"explanation": explanation}


@router.post("/chat")
async def chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Build context for patient
    context = {}
    if current_user.role == "patient" and current_user.linked_id:
        patient_result = await db.execute(select(Patient).where(Patient.id == current_user.linked_id))
        patient = patient_result.scalar_one_or_none()
        if patient:
            context["name"] = patient.name

        # Get latest prescription
        rx_result = await db.execute(
            select(Prescription)
            .where(Prescription.patient_id == current_user.linked_id)
            .order_by(Prescription.created_at.desc())
            .limit(1)
        )
        latest_rx = rx_result.scalar_one_or_none()
        if latest_rx and latest_rx.medicines:
            context["medications"] = ", ".join([m.get("name", "") for m in latest_rx.medicines])

        appt_result = await db.execute(
            select(Appointment)
            .where(Appointment.patient_id == current_user.linked_id)
            .order_by(Appointment.scheduled_at.desc())
            .limit(1)
        )
        latest_appt = appt_result.scalar_one_or_none()
        if latest_appt:
            doctor_result = await db.execute(select(Doctor).where(Doctor.id == latest_appt.doctor_id))
            doctor = doctor_result.scalar_one_or_none()
            status_label = latest_appt.status.replace("_", " ")
            context["appointments"] = (
                f"Latest visit with {doctor.name if doctor else 'doctor'} is {status_label}."
            )

    try:
        response = await ai_chat_response(data.message, context)
    except Exception:
        response = offline_chat_response(data.message, context)
    return {"response": response}
