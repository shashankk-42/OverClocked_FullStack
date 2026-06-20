"""
Seed script — populates the database with demo data.
Run: python seed.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Must import all models before creating tables
from app.models import *  # noqa
from app.db.session import Base
from app.config import settings
from app.auth.hashing import hash_password

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


DOCTORS = [
    {"name": "Dr. Priya Sharma", "specialization": "Internal Medicine", "department": "General Medicine", "email": "dr.sharma@mediflow.ai"},
    {"name": "Dr. Rajesh Kumar", "specialization": "Cardiology", "department": "Cardiology", "email": "dr.kumar@mediflow.ai"},
    {"name": "Dr. Ananya Nair", "specialization": "Neurology", "department": "Neurology", "email": "dr.nair@mediflow.ai"},
    {"name": "Dr. Vikram Singh", "specialization": "Orthopedics", "department": "Orthopedics", "email": "dr.singh@mediflow.ai"},
    {"name": "Dr. Meera Patel", "specialization": "Dermatology", "department": "Dermatology", "email": "dr.patel@mediflow.ai"},
    {"name": "Dr. Arun Reddy", "specialization": "Pediatrics", "department": "Pediatrics", "email": "dr.reddy@mediflow.ai"},
    {"name": "Dr. Sunita Joshi", "specialization": "Gynecology", "department": "Gynecology", "email": "dr.joshi@mediflow.ai"},
    {"name": "Dr. Nikhil Gupta", "specialization": "ENT", "department": "ENT", "email": "dr.gupta@mediflow.ai"},
]

PHARMACY_ITEMS = [
    {"medicine_name": "Metformin", "generic_name": "Metformin HCl", "category": "Antidiabetic", "stock": 500, "unit": "tablets", "price_per_unit": 2.5, "low_stock_threshold": 50},
    {"medicine_name": "Amlodipine", "generic_name": "Amlodipine Besylate", "category": "Antihypertensive", "stock": 300, "unit": "tablets", "price_per_unit": 5.0, "low_stock_threshold": 30},
    {"medicine_name": "Atorvastatin", "generic_name": "Atorvastatin Calcium", "category": "Statin", "stock": 200, "unit": "tablets", "price_per_unit": 8.0, "low_stock_threshold": 20},
    {"medicine_name": "Omeprazole", "generic_name": "Omeprazole", "category": "PPI", "stock": 400, "unit": "capsules", "price_per_unit": 3.5, "low_stock_threshold": 40},
    {"medicine_name": "Paracetamol", "generic_name": "Acetaminophen", "category": "Analgesic", "stock": 1000, "unit": "tablets", "price_per_unit": 1.0, "low_stock_threshold": 100},
    {"medicine_name": "Azithromycin", "generic_name": "Azithromycin", "category": "Antibiotic", "stock": 150, "unit": "tablets", "price_per_unit": 15.0, "low_stock_threshold": 20},
    {"medicine_name": "Cetirizine", "generic_name": "Cetirizine HCl", "category": "Antihistamine", "stock": 10, "unit": "tablets", "price_per_unit": 4.0, "low_stock_threshold": 30},  # low stock
    {"medicine_name": "Vitamin D3", "generic_name": "Cholecalciferol", "category": "Supplement", "stock": 250, "unit": "capsules", "price_per_unit": 6.0, "low_stock_threshold": 25},
    {"medicine_name": "Ibuprofen", "generic_name": "Ibuprofen", "category": "NSAID", "stock": 5, "unit": "tablets", "price_per_unit": 3.0, "low_stock_threshold": 50},  # low stock
    {"medicine_name": "Salbutamol", "generic_name": "Albuterol", "category": "Bronchodilator", "stock": 80, "unit": "inhaler", "price_per_unit": 120.0, "low_stock_threshold": 10},
    {"medicine_name": "Insulin Glargine", "generic_name": "Insulin Glargine", "category": "Insulin", "stock": 30, "unit": "vials", "price_per_unit": 350.0, "low_stock_threshold": 10},
    {"medicine_name": "Lisinopril", "generic_name": "Lisinopril", "category": "ACE Inhibitor", "stock": 180, "unit": "tablets", "price_per_unit": 4.5, "low_stock_threshold": 20},
]

STAFF_USERS = [
    {"email": "reception@mediflow.ai", "password": "demo1234", "role": "receptionist"},
    {"email": "pharmacist@mediflow.ai", "password": "demo1234", "role": "pharmacist"},
    {"email": "admin@mediflow.ai", "password": "demo1234", "role": "admin"},
]

DEMO_PATIENT = {
    "name": "Amit Desai",
    "phone": "9876543210",
    "password": "demo1234",
    "gender": "Male",
    "blood_group": "O+",
    "allergies": "Penicillin",
    "dob": "1982-03-15",
}


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        from sqlalchemy import select
        from app.models.doctor import Doctor
        from app.models.user import User
        from app.models.patient import Patient
        from app.models.pharmacy import PharmacyItem
        from app.models.appointment import Appointment
        from app.models.prescription import Prescription

        print("🌱 Seeding database...")

        # Check if already seeded
        result = await session.execute(select(Doctor).limit(1))
        if result.scalar_one_or_none():
            print("✅ Database already seeded. Skipping.")
            return

        # Seed doctors
        doctor_ids = {}
        for d in DOCTORS:
            doc = Doctor(
                name=d["name"],
                specialization=d["specialization"],
                department=d["department"],
                email=d["email"],
                bio=f"Experienced {d['specialization']} specialist with 10+ years at MediFlow AI Hospital.",
                available_days="Mon,Tue,Wed,Thu,Fri",
                slot_duration_minutes=30,
            )
            session.add(doc)
            await session.flush()
            doctor_ids[d["email"]] = doc.id

            # Create doctor user account
            user = User(
                email=d["email"],
                password_hash=hash_password("demo1234"),
                role="doctor",
                linked_id=doc.id,
            )
            session.add(user)

        print(f"  ✅ {len(DOCTORS)} doctors created")

        # Seed pharmacy inventory
        for item in PHARMACY_ITEMS:
            inv = PharmacyItem(**item)
            session.add(inv)

        print(f"  ✅ {len(PHARMACY_ITEMS)} pharmacy items created")

        # Seed staff users
        for staff in STAFF_USERS:
            user = User(
                email=staff["email"],
                password_hash=hash_password(staff["password"]),
                role=staff["role"],
            )
            session.add(user)

        print(f"  ✅ {len(STAFF_USERS)} staff users created")

        # Seed demo patient
        from app.services.patient import generate_pid
        pid = generate_pid()
        from datetime import date
        patient = Patient(
            pid=pid,
            name=DEMO_PATIENT["name"],
            phone=DEMO_PATIENT["phone"],
            gender=DEMO_PATIENT["gender"],
            blood_group=DEMO_PATIENT["blood_group"],
            allergies=DEMO_PATIENT["allergies"],
            dob=date(1982, 3, 15),
        )
        session.add(patient)
        await session.flush()

        patient_user = User(
            phone=DEMO_PATIENT["phone"],
            password_hash=hash_password(DEMO_PATIENT["password"]),
            role="patient",
            linked_id=patient.id,
        )
        session.add(patient_user)
        await session.flush()

        # Create sample past appointment
        general_medicine_doctor_id = doctor_ids["dr.sharma@mediflow.ai"]
        past_appointment = Appointment(
            patient_id=patient.id,
            doctor_id=general_medicine_doctor_id,
            scheduled_at=datetime.now(timezone.utc) - timedelta(days=30),
            status="completed",
            chief_complaint="Routine diabetes checkup",
            priority="medium",
            triage_department="General Medicine",
            queue_position=1,
        )
        session.add(past_appointment)
        await session.flush()

        # Create sample past prescription
        past_rx = Prescription(
            patient_id=patient.id,
            doctor_id=general_medicine_doctor_id,
            appointment_id=past_appointment.id,
            diagnosis="Type 2 Diabetes Mellitus — controlled",
            medicines=[
                {"name": "Metformin", "generic_name": "Metformin HCl", "dosage": "500mg", "frequency": "twice daily", "duration": "30 days", "instructions": "Take after meals", "quantity": 60},
                {"name": "Vitamin D3", "generic_name": "Cholecalciferol", "dosage": "60000 IU", "frequency": "weekly", "duration": "8 weeks", "instructions": "Take with milk", "quantity": 8},
            ],
            soap_notes={
                "subjective": "Patient reports controlled blood sugar with diet modification. No hypoglycemic episodes.",
                "objective": "BP: 130/85, Fasting glucose: 126 mg/dL, HbA1c: 7.2%",
                "assessment": "Type 2 Diabetes Mellitus — reasonably controlled. Vitamin D deficiency noted.",
                "plan": "Continue Metformin 500mg twice daily. Vitamin D supplementation. Recheck HbA1c in 3 months.",
            },
            status="dispensed",
        )
        session.add(past_rx)

        await session.commit()
        print(f"  ✅ Demo patient created: PID={pid}, Phone=9876543210, Password=demo1234")
        print(f"  ✅ Sample appointment and prescription created")
        print("\n🎉 Seeding complete!")
        print("\n📋 Demo Login Credentials:")
        print(f"  Patient:      phone=9876543210  | password=demo1234")
        print(f"  Doctor:       email=dr.sharma@mediflow.ai | password=demo1234")
        print(f"  Reception:    email=reception@mediflow.ai | password=demo1234")
        print(f"  Pharmacist:   email=pharmacist@mediflow.ai | password=demo1234")
        print(f"  Admin:        email=admin@mediflow.ai | password=demo1234")
        print(f"\n  Patient PID: {pid}")


if __name__ == "__main__":
    asyncio.run(seed())
