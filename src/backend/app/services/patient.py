import uuid
import random
import string
from datetime import datetime, timezone
import io
import os
import qrcode
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.patient import Patient
from app.models.user import User
from app.auth.hashing import hash_password
from app.config import settings


def generate_pid() -> str:
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"MF-{today}-{suffix}"


async def generate_qr_code(pid: str) -> str:
    """Generate QR code and save to uploads dir, return file path."""
    os.makedirs(settings.uploads_dir, exist_ok=True)
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(pid)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    path = os.path.join(settings.uploads_dir, f"qr_{pid}.png")
    img.save(path)
    return path


async def register_patient(
    db: AsyncSession,
    name: str,
    phone: str,
    password: str,
    email: str | None = None,
    dob: str | None = None,
    gender: str | None = None,
    blood_group: str | None = None,
    allergies: str | None = None,
) -> tuple[Patient, User]:
    # Check if phone already exists
    result = await db.execute(select(Patient).where(Patient.phone == phone))
    existing = result.scalar_one_or_none()
    if existing:
        raise ValueError("Phone number already registered")

    # Generate unique PID
    while True:
        pid = generate_pid()
        result = await db.execute(select(Patient).where(Patient.pid == pid))
        if not result.scalar_one_or_none():
            break

    # Create patient record
    from datetime import date as date_type
    parsed_dob = None
    if dob:
        try:
            parsed_dob = datetime.strptime(dob, "%Y-%m-%d").date()
        except ValueError:
            pass

    patient = Patient(
        pid=pid,
        name=name,
        phone=phone,
        email=email,
        dob=parsed_dob,
        gender=gender,
        blood_group=blood_group,
        allergies=allergies,
    )
    db.add(patient)
    await db.flush()

    # Create user account
    user = User(
        phone=phone,
        email=email,
        password_hash=hash_password(password),
        role="patient",
        linked_id=patient.id,
    )
    db.add(user)
    await db.flush()

    return patient, user


async def get_patient_by_pid(db: AsyncSession, pid: str) -> Patient | None:
    result = await db.execute(select(Patient).where(Patient.pid == pid))
    return result.scalar_one_or_none()


async def get_patient_by_id(db: AsyncSession, patient_id: uuid.UUID) -> Patient | None:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    return result.scalar_one_or_none()


async def get_patient_by_phone(db: AsyncSession, phone: str) -> Patient | None:
    result = await db.execute(select(Patient).where(Patient.phone == phone))
    return result.scalar_one_or_none()


async def search_patients(db: AsyncSession, query: str) -> list[Patient]:
    from sqlalchemy import or_
    result = await db.execute(
        select(Patient).where(
            or_(
                Patient.pid.ilike(f"%{query}%"),
                Patient.name.ilike(f"%{query}%"),
                Patient.phone.ilike(f"%{query}%"),
            )
        ).limit(20)
    )
    return list(result.scalars().all())
