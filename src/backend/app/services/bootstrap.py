from sqlalchemy import select

from app.auth.hashing import hash_password
from app.db.session import async_session_factory
from app.models.enhancement import Bed, HospitalLocation, NurseAssignment, PharmacyOrder, Room
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.user import User


DEFAULT_LOCATIONS = [
    {"code": "reception", "name": "Reception", "location_type": "reception", "floor": 1, "x": 8, "y": 8, "adjacent_codes": ["waiting-1", "billing"]},
    {"code": "waiting-1", "name": "Main Waiting Area", "location_type": "waiting", "floor": 1, "x": 24, "y": 8, "adjacent_codes": ["reception", "opd-101", "opd-102", "elevator-1", "stairs-1"]},
    {"code": "billing", "name": "Billing Counter", "location_type": "billing", "floor": 1, "x": 8, "y": 22, "adjacent_codes": ["reception", "pharmacy"]},
    {"code": "pharmacy", "name": "Pharmacy", "location_type": "pharmacy", "floor": 1, "x": 24, "y": 22, "adjacent_codes": ["billing", "waiting-1"]},
    {"code": "emergency", "name": "Emergency Department", "location_type": "emergency", "floor": 1, "x": 44, "y": 8, "adjacent_codes": ["waiting-1", "radiology"]},
    {"code": "opd-101", "name": "OPD Room 101", "location_type": "opd", "department": "General Medicine", "room_number": "101", "floor": 1, "x": 44, "y": 22, "adjacent_codes": ["waiting-1", "opd-102"]},
    {"code": "opd-102", "name": "OPD Room 102", "location_type": "doctor_cabin", "department": "Cardiology", "room_number": "102", "floor": 1, "x": 60, "y": 22, "adjacent_codes": ["waiting-1", "opd-101"]},
    {"code": "restroom-1", "name": "Restrooms", "location_type": "restroom", "floor": 1, "x": 70, "y": 8, "adjacent_codes": ["waiting-1"]},
    {"code": "elevator-1", "name": "Elevator A", "location_type": "elevator", "floor": 1, "x": 80, "y": 20, "adjacent_codes": ["waiting-1", "elevator-2"]},
    {"code": "stairs-1", "name": "Staircase A", "location_type": "stairs", "floor": 1, "x": 88, "y": 20, "adjacent_codes": ["waiting-1", "stairs-2"]},
    {"code": "lab", "name": "Diagnostics Lab", "location_type": "lab", "floor": 2, "x": 18, "y": 12, "adjacent_codes": ["elevator-2", "radiology", "mri-ct"]},
    {"code": "radiology", "name": "Radiology", "location_type": "radiology", "floor": 2, "x": 42, "y": 12, "adjacent_codes": ["lab", "mri-ct", "elevator-2"]},
    {"code": "mri-ct", "name": "MRI / CT Department", "location_type": "imaging", "floor": 2, "x": 66, "y": 12, "adjacent_codes": ["radiology", "lab"]},
    {"code": "waiting-2", "name": "Diagnostics Waiting Area", "location_type": "waiting", "floor": 2, "x": 42, "y": 28, "adjacent_codes": ["lab", "radiology", "elevator-2", "stairs-2"]},
    {"code": "elevator-2", "name": "Elevator A", "location_type": "elevator", "floor": 2, "x": 80, "y": 20, "adjacent_codes": ["elevator-1", "elevator-3", "waiting-2"]},
    {"code": "stairs-2", "name": "Staircase A", "location_type": "stairs", "floor": 2, "x": 88, "y": 20, "adjacent_codes": ["stairs-1", "stairs-3", "waiting-2"]},
    {"code": "icu", "name": "ICU", "location_type": "icu", "floor": 3, "x": 20, "y": 12, "adjacent_codes": ["elevator-3", "ward-a"], "is_restricted": True},
    {"code": "ward-a", "name": "Ward A", "location_type": "ward", "floor": 3, "x": 46, "y": 12, "adjacent_codes": ["icu", "ward-b", "elevator-3"]},
    {"code": "ward-b", "name": "Ward B", "location_type": "ward", "floor": 3, "x": 68, "y": 12, "adjacent_codes": ["ward-a", "restroom-3"]},
    {"code": "restroom-3", "name": "Restrooms", "location_type": "restroom", "floor": 3, "x": 68, "y": 28, "adjacent_codes": ["ward-b"]},
    {"code": "elevator-3", "name": "Elevator A", "location_type": "elevator", "floor": 3, "x": 80, "y": 20, "adjacent_codes": ["elevator-2", "ward-a", "icu"]},
    {"code": "stairs-3", "name": "Staircase A", "location_type": "stairs", "floor": 3, "x": 88, "y": 20, "adjacent_codes": ["stairs-2", "ward-a"]},
]


async def ensure_demo_extensions() -> None:
    async with async_session_factory() as session:
        nurse_result = await session.execute(select(User).where(User.email == "nurse@mediflow.ai"))
        nurse = nurse_result.scalar_one_or_none()
        if not nurse:
            nurse = User(email="nurse@mediflow.ai", password_hash=hash_password("demo1234"), role="nurse")
            session.add(nurse)
            await session.flush()

        location_result = await session.execute(select(HospitalLocation).limit(1))
        if not location_result.scalar_one_or_none():
            for item in DEFAULT_LOCATIONS:
                session.add(HospitalLocation(**item))

        room_result = await session.execute(select(Room).limit(1))
        if not room_result.scalar_one_or_none():
            room = Room(
                room_number="301",
                room_type="General Ward",
                floor="3",
                ward="Ward A",
                price_per_day=1800,
                amenities=["Nurse call", "Oxygen", "Shared restroom"],
                status="available",
            )
            session.add(room)
            await session.flush()
            session.add(Bed(room_id=room.id, bed_number="301-A", bed_type="standard", status="available"))

        patient_result = await session.execute(select(Patient).where(Patient.phone == "9876543210"))
        patient = patient_result.scalar_one_or_none()
        if patient:
            assignment_result = await session.execute(
                select(NurseAssignment).where(
                    NurseAssignment.nurse_user_id == nurse.id,
                    NurseAssignment.patient_id == patient.id,
                )
            )
            if not assignment_result.scalar_one_or_none():
                session.add(
                    NurseAssignment(
                        nurse_user_id=nurse.id,
                        patient_id=patient.id,
                        priority="medium",
                        status="monitoring",
                        instructions="Monitor vitals and medication adherence.",
                    )
                )

            rx_result = await session.execute(
                select(Prescription)
                .where(Prescription.patient_id == patient.id, Prescription.status.in_(["pending", "sent_to_patient"]))
                .order_by(Prescription.created_at.desc())
                .limit(3)
            )
            for prescription in rx_result.scalars().all():
                order_result = await session.execute(
                    select(PharmacyOrder).where(PharmacyOrder.prescription_id == prescription.id)
                )
                if not order_result.scalar_one_or_none():
                    prescription.status = "sent_to_patient"
                    session.add(
                        PharmacyOrder(
                            prescription_id=prescription.id,
                            patient_id=patient.id,
                            status="patient_review",
                        )
                    )

        await session.commit()
