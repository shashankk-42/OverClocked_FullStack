import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.db.session import get_db
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.auth.hashing import verify_password, hash_password
from app.auth.jwt import create_access_token
from app.auth.guards import get_current_user
from app.schemas.schemas import LoginRequest, TokenResponse, PatientRegisterRequest, PatientResponse
from app.services.patient import register_patient

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Find user by email or phone
    result = await db.execute(
        select(User).where(
            or_(User.email == data.identifier, User.phone == data.identifier)
        )
    )
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Account disabled")

    token = create_access_token({"sub": str(user.id), "role": user.role})

    return TokenResponse(
        access_token=token,
        role=user.role,
        user_id=str(user.id),
        linked_id=str(user.linked_id) if user.linked_id else None,
    )


@router.post("/register/patient", response_model=dict, status_code=201)
async def register_patient_route(data: PatientRegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        patient, user = await register_patient(
            db=db,
            name=data.name,
            phone=data.phone,
            password=data.password,
            email=data.email,
            dob=data.dob,
            gender=data.gender,
            blood_group=data.blood_group,
            allergies=data.allergies,
        )
        token = create_access_token({"sub": str(user.id), "role": "patient"})
        return {
            "access_token": token,
            "token_type": "bearer",
            "role": "patient",
            "user_id": str(user.id),
            "linked_id": str(patient.id),
            "pid": patient.pid,
            "name": patient.name,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = {
        "user_id": str(current_user.id),
        "role": current_user.role,
        "email": current_user.email,
        "phone": current_user.phone,
        "linked_id": str(current_user.linked_id) if current_user.linked_id else None,
    }

    # Enrich with profile data
    if current_user.role == "patient" and current_user.linked_id:
        result = await db.execute(select(Patient).where(Patient.id == current_user.linked_id))
        patient = result.scalar_one_or_none()
        if patient:
            data["name"] = patient.name
            data["pid"] = patient.pid

    elif current_user.role == "doctor" and current_user.linked_id:
        result = await db.execute(select(Doctor).where(Doctor.id == current_user.linked_id))
        doctor = result.scalar_one_or_none()
        if doctor:
            data["name"] = doctor.name
            data["department"] = doctor.department

    return data
