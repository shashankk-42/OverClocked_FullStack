import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.guards import require_role
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.enhancement import (
    Bed,
    EmergencyEscalation,
    MedicationAdherenceEvent,
    MedicationTimelineItem,
    NurseAssignment,
    NurseNote,
    PatientVital,
    Room,
    StaffEscalationTicket,
)
from app.models.patient import Patient
from app.models.user import User
from app.services.enhancements import audit_action, notify

router = APIRouter(prefix="/nurse", tags=["Nurse"])


class VitalsRequest(BaseModel):
    patient_id: str
    blood_pressure: str | None = None
    heart_rate: str | None = None
    temperature: str | None = None
    oxygen_saturation: str | None = None
    weight: str | None = None
    height: str | None = None


class AssignmentStatusRequest(BaseModel):
    status: str
    priority: str | None = None
    instructions: str | None = None


class MedicationAdminRequest(BaseModel):
    patient_id: str
    medication_timeline_item_id: str | None = None
    medication_name: str
    status: str = Field(default="taken", pattern="^(taken|missed|delayed|refused)$")
    notes: str | None = None


class NurseNoteRequest(BaseModel):
    patient_id: str
    body: str
    note_type: str = "general"


class DoctorReviewRequest(BaseModel):
    patient_id: str
    reason: str
    priority: str = "medium"


class NurseEmergencyRequest(BaseModel):
    patient_id: str
    severity: str
    location: str | None = None
    notes: str | None = None


async def _patient_dict(db: AsyncSession, patient_id: uuid.UUID) -> dict:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        return {"id": str(patient_id), "name": "Unknown", "pid": "", "phone": ""}
    return {
        "id": str(patient.id),
        "pid": patient.pid,
        "name": patient.name,
        "phone": patient.phone,
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "allergies": patient.allergies,
    }


@router.get("/dashboard")
async def dashboard(
    current_user: User = Depends(require_role("nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    assignment_query = select(NurseAssignment)
    if current_user.role == "nurse":
        assignment_query = assignment_query.where(NurseAssignment.nurse_user_id == current_user.id)
    assignment_query = assignment_query.order_by(NurseAssignment.priority.desc(), NurseAssignment.created_at.desc())
    assignments_result = await db.execute(assignment_query)
    assignments = list(assignments_result.scalars().all())

    rows = []
    for assignment in assignments:
        patient = await _patient_dict(db, assignment.patient_id)
        bed = None
        room = None
        if assignment.bed_id:
            bed_result = await db.execute(select(Bed).where(Bed.id == assignment.bed_id))
            bed = bed_result.scalar_one_or_none()
            if bed:
                room_result = await db.execute(select(Room).where(Room.id == bed.room_id))
                room = room_result.scalar_one_or_none()

        vitals_result = await db.execute(
            select(PatientVital)
            .where(PatientVital.patient_id == assignment.patient_id)
            .order_by(PatientVital.recorded_at.desc())
            .limit(12)
        )
        vitals: dict[str, dict] = {}
        for vital in vitals_result.scalars().all():
            vitals.setdefault(
                vital.vital_type,
                {
                    "value": vital.value,
                    "unit": vital.unit,
                    "recorded_at": vital.recorded_at.isoformat(),
                },
            )

        medications_result = await db.execute(
            select(MedicationTimelineItem)
            .where(MedicationTimelineItem.patient_id == assignment.patient_id, MedicationTimelineItem.status == "active")
            .order_by(MedicationTimelineItem.start_date.desc())
            .limit(8)
        )
        medications = [
            {
                "id": str(item.id),
                "medication_name": item.medicine_name,
                "dosage": item.dosage,
                "frequency": item.frequency,
                "status": item.status,
            }
            for item in medications_result.scalars().all()
        ]

        appointment_result = await db.execute(
            select(Appointment)
            .where(
                Appointment.patient_id == assignment.patient_id,
                Appointment.status.in_(["waiting", "in_consultation", "checked_in"]),
            )
            .order_by(Appointment.scheduled_at.desc())
            .limit(1)
        )
        appointment = appointment_result.scalar_one_or_none()

        rows.append(
            {
                "id": str(assignment.id),
                "patient": patient,
                "priority": assignment.priority,
                "status": assignment.status,
                "instructions": assignment.instructions,
                "room_number": room.room_number if room else None,
                "bed_number": bed.bed_number if bed else None,
                "appointment_status": appointment.status if appointment else None,
                "vitals": vitals,
                "medications": medications,
                "updated_at": assignment.updated_at.isoformat(),
            }
        )

    emergencies_result = await db.execute(
        select(EmergencyEscalation)
        .where(EmergencyEscalation.status.in_(["triggered", "open", "assigned", "in_progress"]))
        .order_by(EmergencyEscalation.created_at.desc())
        .limit(10)
    )
    emergencies = [
        {
            "id": str(item.id),
            "patient_id": str(item.patient_id),
            "severity": item.severity,
            "trigger_source": item.trigger_source,
            "location": item.location,
            "status": item.status,
            "created_at": item.created_at.isoformat(),
        }
        for item in emergencies_result.scalars().all()
    ]

    bed_result = await db.execute(select(Bed))
    beds = list(bed_result.scalars().all())
    bed_summary = {
        "total": len(beds),
        "occupied": sum(1 for bed in beds if bed.status == "occupied"),
        "available": sum(1 for bed in beds if bed.status == "available"),
        "ready_for_discharge": sum(1 for bed in beds if bed.status == "ready_for_discharge"),
    }

    return {
        "assignments": rows,
        "emergencies": emergencies,
        "bed_summary": bed_summary,
        "pending_tasks": sum(1 for row in rows if row["status"] in {"monitoring", "pending_review"}),
    }


@router.post("/vitals")
async def record_vitals(
    data: VitalsRequest,
    current_user: User = Depends(require_role("nurse", "doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    vital_map = {
        "blood_pressure": (data.blood_pressure, "mmHg"),
        "heart_rate": (data.heart_rate, "bpm"),
        "temperature": (data.temperature, "F"),
        "oxygen_saturation": (data.oxygen_saturation, "%"),
        "weight": (data.weight, "kg"),
        "height": (data.height, "cm"),
    }
    created = []
    patient_id = uuid.UUID(data.patient_id)
    for vital_type, (value, unit) in vital_map.items():
        if value:
            vital = PatientVital(
                patient_id=patient_id,
                recorded_by_user_id=current_user.id,
                vital_type=vital_type,
                value=value,
                unit=unit,
            )
            db.add(vital)
            created.append(vital_type)

    if not created:
        raise HTTPException(status_code=400, detail="At least one vital value is required")

    await audit_action(db, current_user, "record_vitals", "patient", data.patient_id, patient_id, {"vitals": created})
    await db.flush()
    return {"message": "Vitals recorded", "created": created}


@router.patch("/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: str,
    data: AssignmentStatusRequest,
    current_user: User = Depends(require_role("nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(NurseAssignment).where(NurseAssignment.id == uuid.UUID(assignment_id)))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if current_user.role == "nurse" and assignment.nurse_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")

    if data.status:
        assignment.status = data.status
    if data.priority:
        assignment.priority = data.priority
    if data.instructions is not None:
        assignment.instructions = data.instructions
    await audit_action(db, current_user, "update_nurse_assignment", "nurse_assignment", assignment_id, assignment.patient_id, data.model_dump())
    await db.flush()
    return {"message": "Assignment updated", "status": assignment.status}


@router.post("/medications/administer")
async def administer_medication(
    data: MedicationAdminRequest,
    current_user: User = Depends(require_role("nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    event = MedicationAdherenceEvent(
        patient_id=uuid.UUID(data.patient_id),
        medication_timeline_item_id=uuid.UUID(data.medication_timeline_item_id) if data.medication_timeline_item_id else None,
        event_type=data.status,
        scheduled_for=datetime.now(timezone.utc),
        occurred_at=datetime.now(timezone.utc),
        payload={
            "source": "nurse",
            "medication_name": data.medication_name,
            "notes": data.notes,
            "recorded_by_user_id": str(current_user.id),
        },
    )
    db.add(event)
    await audit_action(db, current_user, "administer_medication", "patient", data.patient_id, uuid.UUID(data.patient_id), data.model_dump())
    await db.flush()
    return {"message": "Medication event recorded", "event_id": str(event.id)}


@router.post("/notes")
async def add_note(
    data: NurseNoteRequest,
    current_user: User = Depends(require_role("nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    note = NurseNote(
        nurse_user_id=current_user.id,
        patient_id=uuid.UUID(data.patient_id),
        note_type=data.note_type,
        body=data.body,
    )
    db.add(note)
    await audit_action(db, current_user, "add_nurse_note", "patient", data.patient_id, note.patient_id, {"note_type": data.note_type})
    await db.flush()
    return {"message": "Note added", "note_id": str(note.id)}


@router.post("/doctor-review")
async def request_doctor_review(
    data: DoctorReviewRequest,
    current_user: User = Depends(require_role("nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    doctor_result = await db.execute(
        select(Doctor)
        .join(Appointment, Appointment.doctor_id == Doctor.id)
        .where(
            Appointment.patient_id == uuid.UUID(data.patient_id),
            Appointment.status.in_(["waiting", "in_consultation", "checked_in"]),
        )
        .order_by(Appointment.scheduled_at.desc())
        .limit(1)
    )
    doctor = doctor_result.scalar_one_or_none()
    doctor_user = None
    if doctor:
        user_result = await db.execute(select(User).where(User.role == "doctor", User.linked_id == doctor.id))
        doctor_user = user_result.scalar_one_or_none()

    ticket = StaffEscalationTicket(
        patient_id=uuid.UUID(data.patient_id),
        source_type="nurse_review",
        source_id=str(current_user.id),
        assigned_role="doctor",
        summary=data.reason,
        status="open",
    )
    db.add(ticket)
    await db.flush()
    if doctor_user:
        await notify(
            db,
            title="Nurse requested doctor review",
            message=data.reason,
            notification_type="doctor_review",
            user_id=doctor_user.id,
            patient_id=uuid.UUID(data.patient_id),
            priority=data.priority,
            payload={"ticket_id": str(ticket.id)},
        )
    await audit_action(db, current_user, "request_doctor_review", "patient", data.patient_id, uuid.UUID(data.patient_id), data.model_dump())
    return {"message": "Doctor review requested", "ticket_id": str(ticket.id)}


@router.post("/emergencies")
async def escalate_emergency(
    data: NurseEmergencyRequest,
    current_user: User = Depends(require_role("nurse", "doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    escalation = EmergencyEscalation(
        patient_id=uuid.UUID(data.patient_id),
        trigger_source=current_user.role,
        severity=data.severity,
        location=data.location,
        resolution_notes=data.notes,
        created_by_user_id=current_user.id,
        status="triggered",
    )
    db.add(escalation)
    await audit_action(db, current_user, "nurse_emergency_escalation", "patient", data.patient_id, escalation.patient_id, data.model_dump())
    await db.flush()
    return {"message": "Emergency escalated", "id": str(escalation.id)}
