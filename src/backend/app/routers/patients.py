import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.auth.guards import get_current_user, require_role
from app.models.user import User
from app.models.patient import Patient
from app.schemas.schemas import PatientResponse, PatientUpdateRequest
from app.services.patient import get_patient_by_pid, get_patient_by_id, search_patients

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("/me", response_model=PatientResponse)
async def get_my_profile(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_id(db, current_user.linked_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return {
        "id": str(patient.id),
        "pid": patient.pid,
        "name": patient.name,
        "phone": patient.phone,
        "email": patient.email,
        "dob": patient.dob,
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "allergies": patient.allergies,
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
        "created_at": patient.created_at,
    }


@router.get("/search")
async def search(
    q: str,
    current_user: User = Depends(require_role("doctor", "receptionist", "pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    patients = await search_patients(db, q)
    return [
        {
            "id": str(p.id),
            "pid": p.pid,
            "name": p.name,
            "phone": p.phone,
            "gender": p.gender,
            "blood_group": p.blood_group,
        }
        for p in patients
    ]


@router.get("/pid/{pid}")
async def get_by_pid(
    pid: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_pid(db, pid)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "id": str(patient.id),
        "pid": patient.pid,
        "name": patient.name,
        "phone": patient.phone,
        "email": patient.email,
        "dob": str(patient.dob) if patient.dob else None,
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "allergies": patient.allergies,
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
        "created_at": patient.created_at.isoformat(),
    }


@router.patch("/me")
async def update_my_profile(
    data: PatientUpdateRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    patient = await get_patient_by_id(db, current_user.linked_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)
    await db.flush()

    return {"message": "Profile updated", "pid": patient.pid}
