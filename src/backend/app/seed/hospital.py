"""Comprehensive hospital database seed aligned with hospital.md and db-design.txt."""

from __future__ import annotations

import random
import string
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.hashing import hash_password
from app.models import (
    Appointment,
    Bed,
    Bill,
    Doctor,
    EmergencyEscalation,
    FollowUpPlan,
    InsurancePolicy,
    JourneyStep,
    MedicationTimelineItem,
    Notification,
    Patient,
    PatientJourney,
    PatientProfileEntry,
    PatientVital,
    PharmacyItem,
    Prescription,
    Report,
    Room,
    User,
)
from app.seed.catalog import (
    BLOOD_GROUPS,
    COMPLAINTS,
    DEMO_PATIENT,
    DIAGNOSES,
    DOCTOR_DEPARTMENTS,
    DOCTOR_FIRST_NAMES,
    DOCTOR_LAST_NAMES,
    GENDERS,
    INSURANCE_PROVIDERS,
    JOURNEY_STEPS,
    MEDICINE_BASE_NAMES,
    MEDICINE_CATEGORIES,
    PRIMARY_DOCTOR,
    REPORT_TYPES,
    STAFF_USERS,
    TARGETS,
)

RNG = random.Random(42)
PASSWORD = "demo1234"
PASSWORD_HASH = hash_password(PASSWORD)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def make_pid(day_offset: int = 0) -> str:
    day = utcnow() - timedelta(days=day_offset)
    suffix = "".join(RNG.choices(string.ascii_uppercase + string.digits, k=6))
    return f"MF-{day.strftime('%Y%m%d')}-{suffix}"


def pick_medicines(pharmacy_items: list[PharmacyItem], count: int = 2) -> list[dict]:
    chosen = RNG.sample(pharmacy_items, k=min(count, len(pharmacy_items)))
    medicines = []
    for item in chosen:
        qty = RNG.randint(10, 60)
        medicines.append(
            {
                "name": item.medicine_name,
                "generic_name": item.generic_name,
                "dosage": RNG.choice(["250mg", "500mg", "5mg", "10mg", "650mg"]),
                "frequency": RNG.choice(["once daily", "twice daily", "thrice daily", "as needed"]),
                "duration": f"{RNG.randint(5, 30)} days",
                "instructions": RNG.choice(["Take after meals", "Take before sleep", "Take with water"]),
                "quantity": qty,
            }
        )
    return medicines


async def is_seeded(session: AsyncSession) -> bool:
    result = await session.execute(select(Doctor).limit(1))
    return result.scalar_one_or_none() is not None


async def reset_database(session: AsyncSession) -> None:
    await session.execute(
        text(
            "TRUNCATE TABLE "
            "assistant_messages, assistant_conversations, staff_escalation_tickets, "
            "report_shares, qr_access_tokens, patient_vitals, patient_profile_entries, "
            "specialist_referrals, treatment_plans, care_notes, care_team_members, care_teams, "
            "journey_steps, patient_journeys, visual_triage_analyses, visual_triage_uploads, "
            "earlier_slot_offers, appointment_waitlist_entries, appointment_wait_predictions, "
            "insurance_claims, eligibility_checks, insurance_policies, family_members, family_groups, "
            "substitution_requests, medication_cost_analyses, medication_adherence_events, "
            "medication_dispenser_devices, medication_timeline_items, ai_risk_assessments, "
            "follow_up_responses, follow_up_plans, domain_events, notifications, audit_logs, "
            "emergency_escalations, beds, rooms, bills, reports, prescriptions, appointments, "
            "pharmacy_items, users, patients, doctors "
            "RESTART IDENTITY CASCADE"
        )
    )
    await session.commit()


async def seed_doctors(session: AsyncSession) -> list[Doctor]:
    doctors: list[Doctor] = []
    name_idx = 0

    primary = Doctor(
        name=PRIMARY_DOCTOR["name"],
        specialization=PRIMARY_DOCTOR["specialization"],
        department=PRIMARY_DOCTOR["department"],
        email=PRIMARY_DOCTOR["email"],
        phone="9000000001",
        bio="Lead general physician at MediFlow Smart Hospital with 15+ years of experience.",
        available_days="Mon,Tue,Wed,Thu,Fri",
        slot_duration_minutes=30,
    )
    session.add(primary)
    await session.flush()
    doctors.append(primary)
    session.add(
        User(
            email=PRIMARY_DOCTOR["email"],
            password_hash=PASSWORD_HASH,
            role="doctor",
            linked_id=primary.id,
        )
    )

    for department, specialization, count in DOCTOR_DEPARTMENTS:
        for i in range(count):
            if department == PRIMARY_DOCTOR["department"] and i == 0:
                continue
            first = DOCTOR_FIRST_NAMES[name_idx % len(DOCTOR_FIRST_NAMES)]
            last = DOCTOR_LAST_NAMES[name_idx % len(DOCTOR_LAST_NAMES)]
            name_idx += 1
            slug = f"{department.lower().replace(' ', '')}.{i + 1}"
            email = f"dr.{slug}@mediflow.ai"
            doc = Doctor(
                name=f"Dr. {first} {last}",
                specialization=specialization,
                department=department,
                email=email,
                phone=f"900000{1000 + len(doctors):04d}",
                bio=f"{specialization} at MediFlow Smart Hospital — {department} department.",
                available_days="Mon,Tue,Wed,Thu,Fri,Sat",
                slot_duration_minutes=30,
            )
            session.add(doc)
            await session.flush()
            doctors.append(doc)
            session.add(User(email=email, password_hash=PASSWORD_HASH, role="doctor", linked_id=doc.id))

    await session.flush()
    return doctors


async def seed_pharmacy(session: AsyncSession) -> list[PharmacyItem]:
    items: list[PharmacyItem] = []
    for category, count in MEDICINE_CATEGORIES:
        base_names = MEDICINE_BASE_NAMES.get(category, MEDICINE_BASE_NAMES["General"])
        for i in range(count):
            base = base_names[i % len(base_names)]
            variant = base if i < len(base_names) else f"{base} {RNG.choice(['XR', 'Plus', 'DS', 'Fort'])}"
            stock = RNG.randint(5, 1200)
            threshold = max(10, stock // 10)
            item = PharmacyItem(
                medicine_name=variant,
                generic_name=variant.split()[0],
                category=category,
                stock=stock,
                unit=RNG.choice(["tablets", "capsules", "ml", "vials", "inhaler"]),
                price_per_unit=round(RNG.uniform(1.0, 450.0), 2),
                low_stock_threshold=threshold,
                manufacturer=RNG.choice(["MediFlow Pharma", "Sun Pharma", "Cipla", "Dr Reddy's", "Abbott"]),
            )
            items.append(item)
    session.add_all(items)
    await session.flush()
    return items


async def seed_staff(session: AsyncSession) -> None:
    for staff in STAFF_USERS:
        session.add(
            User(
                email=staff["email"],
                password_hash=PASSWORD_HASH,
                role=staff["role"],
            )
        )
    await session.flush()


async def seed_patients(session: AsyncSession) -> tuple[list[Patient], Patient]:
    patients: list[Patient] = []
    demo = Patient(
        pid=make_pid(0),
        name=DEMO_PATIENT["name"],
        phone=DEMO_PATIENT["phone"],
        email=DEMO_PATIENT["email"],
        gender=DEMO_PATIENT["gender"],
        blood_group=DEMO_PATIENT["blood_group"],
        allergies=DEMO_PATIENT["allergies"],
        dob=date(DEMO_PATIENT["dob_year"], DEMO_PATIENT["dob_month"], DEMO_PATIENT["dob_day"]),
        address=DEMO_PATIENT["address"],
        emergency_contact_name=DEMO_PATIENT["emergency_contact_name"],
        emergency_contact_phone=DEMO_PATIENT["emergency_contact_phone"],
    )
    session.add(demo)
    await session.flush()
    patients.append(demo)
    session.add(
        User(
            phone=DEMO_PATIENT["phone"],
            email=DEMO_PATIENT["email"],
            password_hash=PASSWORD_HASH,
            role="patient",
            linked_id=demo.id,
        )
    )

    for i in range(1, TARGETS["patients"]):
        age = RNG.randint(1, 85)
        dob = date.today().replace(year=date.today().year - age)
        patient = Patient(
            pid=make_pid(RNG.randint(0, 730)),
            name=f"{RNG.choice(['Aarav', 'Isha', 'Rohan', 'Kavya', 'Vihaan', 'Anaya', 'Arjun', 'Diya', 'Kabir', 'Myra'])} "
            f"{RNG.choice(['Sharma', 'Patel', 'Reddy', 'Iyer', 'Desai', 'Mehta', 'Nair', 'Singh', 'Gupta', 'Kapoor'])}",
            phone=f"919{900000000 + i:09d}",
            email=f"patient{i}@demo.mediflow.ai",
            gender=RNG.choice(GENDERS),
            blood_group=RNG.choice(BLOOD_GROUPS),
            allergies=RNG.choice(["None", "Penicillin", "Sulfa", "Peanuts", "Latex", None]),
            dob=dob,
            address=f"Ward {RNG.randint(1, 12)}, MediFlow Campus, Pune",
            emergency_contact_name=RNG.choice(["Family Member", "Spouse", "Parent", "Sibling"]),
            emergency_contact_phone=f"91{RNG.randint(100000000, 999999999)}",
        )
        patients.append(patient)

    session.add_all(patients[1:])
    await session.flush()

    # Login accounts for first 25 non-demo patients (for spot testing)
    for patient in patients[1:26]:
        session.add(
            User(
                phone=patient.phone,
                email=patient.email,
                password_hash=PASSWORD_HASH,
                role="patient",
                linked_id=patient.id,
            )
        )
    await session.flush()
    return patients, demo


async def seed_rooms_and_beds(session: AsyncSession, patients: list[Patient]) -> list[Bed]:
    beds: list[Bed] = []
    bed_plan = [
        ("General Ward", "general_ward", "2", 80, "standard", 1200),
        ("Private Room", "private", "2", 40, "private", 3500),
        ("ICU", "icu", "2", 20, "icu", 8500),
        ("Emergency", "emergency", "Ground", 10, "emergency", 5000),
    ]
    admitted = RNG.sample(patients, k=TARGETS["admitted_patients"])
    icu_patients = set(p.id for p in RNG.sample(admitted, k=min(TARGETS["icu_patients"], len(admitted))))
    room_no = 100
    admit_idx = 0

    for ward, room_type, floor, count, bed_type, price in bed_plan:
        beds_in_type = 0
        while beds_in_type < count:
            room_no += 1
            beds_this_room = 2 if room_type == "general_ward" and (count - beds_in_type) >= 2 else 1
            beds_this_room = min(beds_this_room, count - beds_in_type)
            room = Room(
                room_number=f"{floor[0]}{room_no}",
                room_type=room_type.replace("_", " ").title(),
                floor=floor,
                ward=ward,
                price_per_day=price,
                amenities=["Oxygen", "Nurse call", "Wi-Fi"] if bed_type != "icu" else ["Ventilator", "Monitor", "Oxygen"],
                status="available",
            )
            session.add(room)
            await session.flush()
            for b in range(beds_this_room):
                occupant = None
                status = "available"
                if admit_idx < len(admitted):
                    candidate = admitted[admit_idx]
                    if bed_type == "icu" and candidate.id in icu_patients:
                        occupant = candidate
                        admit_idx += 1
                        status = "occupied"
                    elif bed_type != "icu" and candidate.id not in icu_patients:
                        occupant = candidate
                        admit_idx += 1
                        status = "occupied"
                    elif bed_type != "icu":
                        admit_idx += 1
                beds.append(
                    Bed(
                        room_id=room.id,
                        bed_number=chr(65 + b),
                        bed_type=bed_type,
                        status=status,
                        current_patient_id=occupant.id if occupant else None,
                    )
                )
                beds_in_type += 1
    session.add_all(beds)
    await session.flush()
    return beds


async def seed_appointments(
    session: AsyncSession,
    patients: list[Patient],
    doctors: list[Doctor],
    demo_patient: Patient,
) -> tuple[list[Appointment], list[Appointment]]:
    appointments: list[Appointment] = []
    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    primary_doctor = doctors[0]

    def create_appt(patient, doctor, when, status, priority="medium", queue=None):
        appt = Appointment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            scheduled_at=when,
            status=status,
            queue_position=queue,
            chief_complaint=RNG.choice(COMPLAINTS),
            priority=priority,
            triage_department=doctor.department,
        )
        appointments.append(appt)
        return appt

    # Demo patient journey — in consultation today
    create_appt(
        demo_patient,
        primary_doctor,
        today.replace(hour=10, minute=30),
        "in_consultation",
        priority="high",
        queue=1,
    )
    create_appt(
        demo_patient,
        primary_doctor,
        today - timedelta(days=30),
        "completed",
        priority="medium",
        queue=1,
    )

    # Today's live queue for reception/doctor dashboards
    queue_patients = [p for p in patients if p.id != demo_patient.id]
    today_pool = RNG.sample(queue_patients, k=min(TARGETS["today_opd"], len(queue_patients)))
    for idx, patient in enumerate(today_pool[:12], start=2):
        doctor = RNG.choice(doctors)
        status = RNG.choice(["booked", "checked_in", "checked_in", "in_consultation", "completed"])
        create_appt(
            patient,
            doctor,
            today.replace(hour=9, minute=0) + timedelta(minutes=30 * idx),
            status,
            priority=RNG.choice(["low", "medium", "high", "emergency"]),
            queue=idx if status in {"checked_in", "in_consultation"} else None,
        )

    # Past appointments
    for _ in range(TARGETS["past_appointments"]):
        patient = RNG.choice(patients)
        doctor = RNG.choice(doctors)
        when = today - timedelta(days=RNG.randint(1, 720), hours=RNG.randint(8, 17))
        create_appt(
            patient,
            doctor,
            when,
            RNG.choice(["completed", "completed", "completed", "cancelled"]),
            priority=RNG.choice(["low", "medium", "high"]),
        )

    # Upcoming appointments
    upcoming: list[Appointment] = []
    for _ in range(TARGETS["upcoming_appointments"]):
        patient = RNG.choice(patients)
        doctor = RNG.choice(doctors)
        when = today + timedelta(days=RNG.randint(1, 45), hours=RNG.randint(8, 17))
        appt = create_appt(patient, doctor, when, "booked", priority=RNG.choice(["low", "medium", "high"]))

    session.add_all(appointments)
    await session.flush()
    upcoming_appts = [a for a in appointments if a.status == "booked" and a.scheduled_at > today]
    return appointments, upcoming_appts


async def seed_prescriptions_and_bills(
    session: AsyncSession,
    appointments: list[Appointment],
    pharmacy_items: list[PharmacyItem],
) -> tuple[list[Prescription], list[Bill]]:
    prescriptions: list[Prescription] = []
    bills: list[Bill] = []
    completed = [a for a in appointments if a.status == "completed"]
    if len(completed) < TARGETS["prescriptions"]:
        for appt in appointments:
            if appt.status != "completed":
                appt.status = "completed"
            if len(completed) >= TARGETS["prescriptions"]:
                break
            if appt not in completed:
                completed.append(appt)

    for appt in completed[: TARGETS["prescriptions"]]:
        medicines = pick_medicines(pharmacy_items)
        status = "dispensed"
        rx = Prescription(
            patient_id=appt.patient_id,
            doctor_id=appt.doctor_id,
            appointment_id=appt.id,
            diagnosis=RNG.choice(DIAGNOSES),
            medicines=medicines,
            soap_notes={
                "subjective": "Patient reports symptoms consistent with follow-up visit.",
                "objective": "Vitals stable. Physical exam unremarkable.",
                "assessment": RNG.choice(DIAGNOSES),
                "plan": "Continue current medications and lifestyle advice.",
            },
            status=status,
        )
        prescriptions.append(rx)

    # Keep a small pharmacy queue for the live demo
    pending_demo = [a for a in appointments if a.status in {"checked_in", "in_consultation", "booked"}][:8]
    for appt in pending_demo:
        prescriptions.append(
            Prescription(
                patient_id=appt.patient_id,
                doctor_id=appt.doctor_id,
                appointment_id=appt.id,
                diagnosis=RNG.choice(DIAGNOSES),
                medicines=pick_medicines(pharmacy_items),
                status="pending",
            )
        )

    session.add_all(prescriptions)
    await session.flush()

    dispensed = [rx for rx in prescriptions if rx.status == "dispensed"]
    for rx in dispensed:
        items = []
        subtotal = 0.0
        for med in rx.medicines or []:
            unit_price = next(
                (float(p.price_per_unit) for p in pharmacy_items if p.medicine_name == med["name"]),
                round(RNG.uniform(2, 120), 2),
            )
            qty = med.get("quantity", 10)
            total = round(unit_price * qty, 2)
            subtotal += total
            items.append(
                {
                    "medicine_name": med["name"],
                    "quantity": qty,
                    "unit_price": unit_price,
                    "total": total,
                }
            )
        tax = round(subtotal * 0.05, 2)
        bills.append(
            Bill(
                patient_id=rx.patient_id,
                prescription_id=rx.id,
                items=items,
                subtotal=subtotal,
                tax=tax,
                total_amount=round(subtotal + tax, 2),
                payment_status=RNG.choice(["paid", "paid", "pending"]),
                payment_method=RNG.choice(["simulated", "upi", "razorpay", "insurance"]),
            )
        )

    # Consultation-only bills to reach db-design target
    extra_bills = TARGETS["bills"] - len(bills)
    for appt in RNG.sample(completed, k=min(extra_bills, len(completed))):
        fee = round(RNG.uniform(300, 1500), 2)
        tax = round(fee * 0.05, 2)
        bills.append(
            Bill(
                patient_id=appt.patient_id,
                prescription_id=None,
                items=[{"description": "Consultation fee", "quantity": 1, "unit_price": fee, "total": fee}],
                subtotal=fee,
                tax=tax,
                total_amount=round(fee + tax, 2),
                payment_status=RNG.choice(["paid", "pending"]),
                payment_method=RNG.choice(["simulated", "upi", "razorpay"]),
            )
        )

    session.add_all(bills)
    await session.flush()
    return prescriptions, bills


async def seed_reports(session: AsyncSession, patients: list[Patient]) -> list[Report]:
    reports: list[Report] = []
    for report_type, count in REPORT_TYPES:
        for _ in range(count):
            patient = RNG.choice(patients)
            reports.append(
                Report(
                    patient_id=patient.id,
                    report_type=report_type,
                    file_name=f"{report_type}_{uuid.uuid4().hex[:8]}.pdf",
                    summary=f"{report_type.replace('_', ' ').title()} report for {patient.name}",
                    key_findings=RNG.choice(
                        [
                            "Within normal limits",
                            "Mild abnormality noted — follow-up advised",
                            "Elevated markers — physician review recommended",
                            "No acute findings",
                        ]
                    ),
                    is_analyzed=True,
                    uploaded_by=RNG.choice(["patient", "doctor", "lab"]),
                    created_at=utcnow() - timedelta(days=RNG.randint(1, 400)),
                )
            )
    session.add_all(reports)
    await session.flush()
    return reports


async def seed_enhancements(
    session: AsyncSession,
    patients: list[Patient],
    doctors: list[Doctor],
    demo_patient: Patient,
    prescriptions: list[Prescription],
    beds: list[Bed],
) -> None:
    # Medication timeline from dispensed prescriptions
    timeline: list[MedicationTimelineItem] = []
    for rx in prescriptions[:300]:
        if not rx.medicines:
            continue
        for med in rx.medicines[:2]:
            timeline.append(
                MedicationTimelineItem(
                    patient_id=rx.patient_id,
                    prescription_id=rx.id,
                    doctor_id=rx.doctor_id,
                    medicine_name=med["name"],
                    dosage=med.get("dosage"),
                    frequency=med.get("frequency"),
                    status="active",
                    dispenser_ready=True,
                    metadata_json=med,
                )
            )
    session.add_all(timeline)

    # Insurance policies
    policies: list[InsurancePolicy] = []
    for patient in RNG.sample(patients, k=180):
        policies.append(
            InsurancePolicy(
                patient_id=patient.id,
                provider=RNG.choice(INSURANCE_PROVIDERS),
                policy_number=f"POL-{uuid.uuid4().hex[:10].upper()}",
                policy_type=RNG.choice(["individual", "family", "corporate"]),
                coverage_info={"outpatient": True, "pharmacy": True, "room_coverage": "standard"},
                status="active",
            )
        )
    session.add_all(policies)

    # Emergency escalations
    emergencies: list[EmergencyEscalation] = []
    for patient in RNG.sample(patients, k=TARGETS["emergency_cases"]):
        emergencies.append(
            EmergencyEscalation(
                patient_id=patient.id,
                trigger_source=RNG.choice(["patient", "receptionist", "nurse"]),
                severity=RNG.choice(["urgent", "critical", "life_threatening"]),
                location=RNG.choice(["Emergency Bay", "Main Lobby", "ICU", "OPD Waiting Area"]),
                status=RNG.choice(["triggered", "assigned", "resolved"]),
            )
        )
    emergencies.append(
        EmergencyEscalation(
            patient_id=demo_patient.id,
            trigger_source="patient",
            severity="urgent",
            location="OPD Waiting Area",
            status="assigned",
        )
    )
    session.add_all(emergencies)

    # Patient journeys (admitted + demo)
    journey_patient_ids = [demo_patient.id] + [b.current_patient_id for b in beds if b.current_patient_id][:20]
    for patient_id in journey_patient_ids:
        if not patient_id:
            continue
        journey = PatientJourney(patient_id=patient_id, status="active")
        session.add(journey)
        await session.flush()
        steps = []
        for order, (name, dept, floor, room) in enumerate(JOURNEY_STEPS, start=1):
            step = JourneyStep(
                journey_id=journey.id,
                step_order=order,
                name=name,
                department=dept,
                floor=floor,
                room_number=room,
                estimated_duration_minutes=RNG.randint(10, 45),
                status="completed" if order <= 2 else ("in_progress" if order == 3 else "pending"),
            )
            steps.append(step)
        session.add_all(steps)

    # Follow-up plans
    followups = []
    for patient in RNG.sample(patients, k=80):
        followups.append(
            FollowUpPlan(
                patient_id=patient.id,
                doctor_id=RNG.choice(doctors).id,
                plan_type="post_consultation",
                questionnaire=[{"question": "How are your symptoms?", "type": "text"}],
                due_at=utcnow() + timedelta(days=RNG.randint(2, 14)),
                status=RNG.choice(["scheduled", "submitted", "completed"]),
            )
        )
    session.add_all(followups)

    # Profile entries & vitals
    entries = []
    vitals = []
    for patient in RNG.sample(patients, k=120):
        entries.append(
            PatientProfileEntry(
                patient_id=patient.id,
                entry_type="condition",
                title=RNG.choice(["Hypertension", "Diabetes", "Asthma", "Hypothyroidism"]),
                details="Documented in MediFlow Smart Hospital EHR.",
                occurred_at=utcnow() - timedelta(days=RNG.randint(30, 900)),
            )
        )
        vitals.append(
            PatientVital(
                patient_id=patient.id,
                vital_type="blood_pressure",
                value=f"{RNG.randint(110, 150)}/{RNG.randint(70, 95)}",
                unit="mmHg",
            )
        )
    session.add_all(entries)
    session.add_all(vitals)

    # Staff notifications
    notifications = [
        Notification(title="Emergency escalation", message="Urgent case in Emergency Bay", notification_type="emergency", role="doctor", priority="high"),
        Notification(title="Low stock alert", message="Ibuprofen below threshold", notification_type="inventory", role="pharmacist", priority="high"),
        Notification(title="Queue update", message="12 patients in live queue", notification_type="queue", role="receptionist", priority="normal"),
        Notification(title="Follow-up due", message="Patient follow-up questionnaire ready", notification_type="follow_up", role="doctor", priority="normal"),
    ]
    session.add_all(notifications)
    await session.flush()


async def seed_hospital(session: AsyncSession, *, force: bool = False) -> dict:
    if force:
        await reset_database(session)
    elif await is_seeded(session):
        return {"skipped": True}

    print("🏥 Seeding MediFlow Smart Hospital dataset...")
    doctors = await seed_doctors(session)
    print(f"  ✅ {len(doctors)} doctors")

    pharmacy_items = await seed_pharmacy(session)
    print(f"  ✅ {len(pharmacy_items)} medicines")

    await seed_staff(session)
    print(f"  ✅ {len(STAFF_USERS)} staff demo accounts")

    patients, demo_patient = await seed_patients(session)
    print(f"  ✅ {len(patients)} patients")

    beds = await seed_rooms_and_beds(session, patients)
    print(f"  ✅ {len(beds)} beds across hospital floors")

    appointments, upcoming = await seed_appointments(session, patients, doctors, demo_patient)
    print(f"  ✅ {len(appointments)} appointments ({len(upcoming)} upcoming)")

    prescriptions, bills = await seed_prescriptions_and_bills(session, appointments, pharmacy_items)
    print(f"  ✅ {len(prescriptions)} prescriptions, {len(bills)} bills")

    reports = await seed_reports(session, patients)
    print(f"  ✅ {len(reports)} reports")

    await seed_enhancements(session, patients, doctors, demo_patient, prescriptions, beds)
    print("  ✅ journeys, emergencies, insurance, vitals, notifications")

    await session.commit()

    summary = {
        "skipped": False,
        "doctors": len(doctors),
        "patients": len(patients),
        "medicines": len(pharmacy_items),
        "appointments": len(appointments),
        "prescriptions": len(prescriptions),
        "reports": len(reports),
        "bills": len(bills),
        "beds": len(beds),
        "demo_patient_pid": demo_patient.pid,
    }
    print("\n🎉 Hospital seed complete!")
    print("📋 Demo logins (password: demo1234)")
    print(f"  Patient:    phone={DEMO_PATIENT['phone']}")
    print(f"  Doctor:     email={PRIMARY_DOCTOR['email']}")
    print("  Reception:  email=reception@mediflow.ai")
    print("  Pharmacy:   email=pharmacist@mediflow.ai")
    print("  Nurse:      email=nurse@mediflow.ai")
    print("  Admin:      email=admin@mediflow.ai")
    print(f"  Demo PID:   {demo_patient.pid}")
    return summary
