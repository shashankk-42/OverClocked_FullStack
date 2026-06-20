import os
import uuid
from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe
from typing import Any

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.alt_medicine import ai_chat_response
from app.auth.guards import get_current_user, require_role
from app.config import settings
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.enhancement import (
    AiRiskAssessment,
    AppointmentWaitlistEntry,
    AssistantConversation,
    AssistantMessage,
    Bed,
    CareNote,
    CareTeam,
    CareTeamMember,
    EarlierSlotOffer,
    EligibilityCheck,
    EmergencyEscalation,
    FamilyGroup,
    FamilyMember,
    FollowUpPlan,
    FollowUpResponse,
    InsuranceClaim,
    InsurancePolicy,
    JourneyStep,
    MedicationAdherenceEvent,
    MedicationDispenserDevice,
    MedicationTimelineItem,
    PatientJourney,
    PatientProfileEntry,
    PatientVital,
    QrAccessToken,
    ReportShare,
    Room,
    SpecialistReferral,
    StaffEscalationTicket,
    SubstitutionRequest,
    TreatmentPlan,
    VisualTriageAnalysis,
    VisualTriageUpload,
)
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.report import Report
from app.models.user import User
from app.services.enhancements import (
    audit_action,
    calculate_prescription_cost,
    model_to_dict,
    notify,
    predict_wait_time,
    publish_event,
    sync_medication_timeline_from_prescription,
    utcnow,
)

router = APIRouter(prefix="/enhancements", tags=["Enhancements"])


class EmergencyCreateRequest(BaseModel):
    patient_id: str | None = None
    pid: str | None = None
    trigger_source: str
    severity: str
    location: str | None = None


class EmergencyAssignRequest(BaseModel):
    assigned_responders: list[dict[str, Any]]


class StatusUpdateRequest(BaseModel):
    status: str
    notes: str | None = None


class FollowUpPlanRequest(BaseModel):
    patient_id: str
    appointment_id: str | None = None
    plan_type: str = "post_consultation"
    questionnaire: list[dict[str, Any]] | None = None
    due_at: datetime


class FollowUpResponseRequest(BaseModel):
    symptoms: str | None = None
    medication_adherence: str | None = None
    recovery_status: str | None = None
    answers: dict[str, Any] | None = None


class DeviceRegisterRequest(BaseModel):
    patient_id: str
    device_identifier: str
    label: str | None = None
    metadata: dict[str, Any] | None = None


class AdherenceEventRequest(BaseModel):
    patient_id: str
    medication_timeline_item_id: str | None = None
    event_type: str
    scheduled_for: datetime | None = None
    payload: dict[str, Any] | None = None


class RoomRequest(BaseModel):
    room_number: str
    room_type: str
    floor: str | None = None
    ward: str | None = None
    price_per_day: float = 0
    amenities: list[str] | None = None
    status: str = "available"


class BedRequest(BaseModel):
    room_id: str
    bed_number: str
    bed_type: str = "standard"
    status: str = "available"


class BedStatusRequest(BaseModel):
    status: str
    current_patient_id: str | None = None


class SubstitutionRequestBody(BaseModel):
    original_medicine: str
    substitute_medicine: str
    reason: str | None = None


class FamilyGroupRequest(BaseModel):
    name: str


class FamilyMemberRequest(BaseModel):
    patient_id: str
    relationship: str
    access_level: str = "appointment_only"


class InsurancePolicyRequest(BaseModel):
    patient_id: str
    provider: str
    policy_number: str
    policy_type: str = "individual"
    coverage_info: dict[str, Any] | None = None


class EligibilityRequest(BaseModel):
    insurance_policy_id: str
    service_type: str
    estimate_amount: float


class ClaimRequest(BaseModel):
    insurance_policy_id: str
    bill_id: str | None = None
    claim_number: str | None = None
    amount: float = 0
    metadata: dict[str, Any] | None = None


class WaitlistRequest(BaseModel):
    appointment_id: str | None = None
    doctor_id: str | None = None
    specialty: str | None = None
    earliest_acceptable_at: datetime | None = None


class EarlierOfferRequest(BaseModel):
    waitlist_entry_id: str
    doctor_id: str
    offered_slot_at: datetime
    expires_at: datetime | None = None


class AssistantConversationRequest(BaseModel):
    topic: str | None = None


class AssistantMessageRequest(BaseModel):
    message: str


class StaffEscalationRequest(BaseModel):
    source_type: str
    source_id: str
    summary: str
    assigned_role: str = "receptionist"


class ProfileEntryRequest(BaseModel):
    patient_id: str
    entry_type: str
    title: str
    details: str | None = None
    occurred_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class VitalRequest(BaseModel):
    patient_id: str
    vital_type: str
    value: str
    unit: str | None = None
    recorded_at: datetime | None = None


class QrTokenRequest(BaseModel):
    patient_id: str
    scope: str = "emergency"
    expires_at: datetime | None = None


class ReportShareRequest(BaseModel):
    patient_id: str
    expires_at: datetime | None = None


class CareTeamRequest(BaseModel):
    patient_id: str
    name: str


class CareMemberRequest(BaseModel):
    doctor_id: str | None = None
    user_id: str | None = None
    role: str = "collaborator"


class CareNoteRequest(BaseModel):
    note_type: str = "shared_note"
    body: str


class TreatmentPlanRequest(BaseModel):
    title: str
    plan: dict[str, Any] | None = None


class ReferralRequest(BaseModel):
    patient_id: str
    to_specialty: str
    to_doctor_id: str | None = None
    reason: str


class JourneyCreateRequest(BaseModel):
    patient_id: str
    appointment_id: str | None = None
    steps: list[dict[str, Any]]


class JourneyStepStatusRequest(BaseModel):
    status: str


class VisualAnalysisRequest(BaseModel):
    ai_summary: str | None = None
    visible_abnormalities: list[str] | None = None
    highlighted_concerns: list[str] | None = None
    urgency_level: str | None = None
    confidence_score: float | None = None


async def resolve_patient_id(
    db: AsyncSession,
    current_user: User,
    patient_id: str | None = None,
    pid: str | None = None,
) -> uuid.UUID:
    if current_user.role == "patient":
        if not current_user.linked_id:
            raise HTTPException(status_code=403, detail="Patient account is not linked to a profile")
        return current_user.linked_id

    if patient_id:
        return uuid.UUID(patient_id)

    if pid:
        result = await db.execute(select(Patient).where(Patient.pid == pid))
        patient = result.scalar_one_or_none()
        if patient:
            return patient.id

    raise HTTPException(status_code=400, detail="patient_id or pid is required")


async def get_patient_or_404(db: AsyncSession, patient_id: uuid.UUID) -> Patient:
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/audit-logs")
async def list_audit_logs(
    action: str | None = None,
    resource_type: str | None = None,
    current_user: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.enhancement import AuditLog

    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    result = await db.execute(query)
    return [model_to_dict(row) for row in result.scalars().all()]


@router.get("/notifications")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.enhancement import Notification

    result = await db.execute(
        select(Notification)
        .where(
            (Notification.user_id == current_user.id)
            | (Notification.role == current_user.role)
            | (Notification.patient_id == current_user.linked_id)
        )
        .order_by(Notification.created_at.desc())
        .limit(100)
    )
    return [model_to_dict(row) for row in result.scalars().all()]


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.enhancement import Notification

    result = await db.execute(select(Notification).where(Notification.id == uuid.UUID(notification_id)))
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read_at = utcnow()
    await audit_action(db, current_user, "notification.read", "notification", notification_id)
    return model_to_dict(notification)


@router.post("/emergencies")
async def create_emergency(
    data: EmergencyCreateRequest,
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    patient_id = await resolve_patient_id(db, current_user, data.patient_id, data.pid)
    severity = data.severity.lower().replace(" ", "_")
    if severity not in {"urgent", "critical", "life_threatening"}:
        raise HTTPException(status_code=400, detail="Severity must be urgent, critical, or life threatening")

    emergency = EmergencyEscalation(
        patient_id=patient_id,
        trigger_source=data.trigger_source,
        severity=severity,
        location=data.location,
        created_by_user_id=current_user.id,
    )
    db.add(emergency)
    await db.flush()
    await audit_action(db, current_user, "emergency.created", "emergency", str(emergency.id), patient_id)
    await publish_event(db, "emergency.created", "emergency", str(emergency.id), patient_id, model_to_dict(emergency))
    await notify(
        db,
        "Emergency escalation",
        f"{severity.replace('_', ' ').title()} emergency triggered",
        "emergency",
        role="doctor",
        patient_id=patient_id,
        priority="high",
        payload={"emergency_id": str(emergency.id)},
    )
    await notify(
        db,
        "Emergency escalation",
        f"{severity.replace('_', ' ').title()} emergency triggered",
        "emergency",
        role="receptionist",
        patient_id=patient_id,
        priority="high",
        payload={"emergency_id": str(emergency.id)},
    )
    return model_to_dict(emergency)


@router.get("/emergencies")
async def list_emergencies(
    status: str | None = None,
    current_user: User = Depends(require_role("doctor", "nurse", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    query = select(EmergencyEscalation).order_by(EmergencyEscalation.created_at.desc()).limit(100)
    if status:
        query = query.where(EmergencyEscalation.status == status)
    result = await db.execute(query)
    return [model_to_dict(row) for row in result.scalars().all()]


@router.patch("/emergencies/{emergency_id}/assign")
async def assign_emergency(
    emergency_id: str,
    data: EmergencyAssignRequest,
    current_user: User = Depends(require_role("doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(EmergencyEscalation).where(EmergencyEscalation.id == uuid.UUID(emergency_id)))
    emergency = result.scalar_one_or_none()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    emergency.assigned_responders = data.assigned_responders
    emergency.status = "assigned"
    await audit_action(db, current_user, "emergency.assigned", "emergency", emergency_id, emergency.patient_id)
    await publish_event(db, "emergency.assigned", "emergency", emergency_id, emergency.patient_id, data.model_dump())
    return model_to_dict(emergency)


@router.patch("/emergencies/{emergency_id}/status")
async def update_emergency_status(
    emergency_id: str,
    data: StatusUpdateRequest,
    current_user: User = Depends(require_role("doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(EmergencyEscalation).where(EmergencyEscalation.id == uuid.UUID(emergency_id)))
    emergency = result.scalar_one_or_none()
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")
    if data.status not in {"acknowledged", "assigned", "in_progress", "resolved", "cancelled"}:
        raise HTTPException(status_code=400, detail="Invalid emergency status")
    emergency.status = data.status
    if data.notes:
        emergency.resolution_notes = data.notes
    if data.status in {"resolved", "cancelled"}:
        emergency.resolved_at = utcnow()
    await audit_action(db, current_user, f"emergency.{data.status}", "emergency", emergency_id, emergency.patient_id)
    await publish_event(db, f"emergency.{data.status}", "emergency", emergency_id, emergency.patient_id)
    return model_to_dict(emergency)


@router.post("/follow-ups/plans")
async def create_follow_up_plan(
    data: FollowUpPlanRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    plan = FollowUpPlan(
        patient_id=uuid.UUID(data.patient_id),
        doctor_id=current_user.linked_id if current_user.role == "doctor" else None,
        appointment_id=uuid.UUID(data.appointment_id) if data.appointment_id else None,
        plan_type=data.plan_type,
        questionnaire=data.questionnaire or [],
        due_at=data.due_at,
    )
    db.add(plan)
    await db.flush()
    await audit_action(db, current_user, "follow_up.created", "follow_up_plan", str(plan.id), plan.patient_id)
    await notify(db, "Follow-up scheduled", "A follow-up questionnaire is ready", "follow_up", patient_id=plan.patient_id)
    return model_to_dict(plan)


@router.get("/follow-ups/my")
async def my_follow_ups(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FollowUpPlan)
        .where(FollowUpPlan.patient_id == current_user.linked_id)
        .order_by(FollowUpPlan.due_at.asc())
    )
    return [model_to_dict(row) for row in result.scalars().all()]


@router.get("/follow-ups/review")
async def follow_up_review(
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    query = select(FollowUpPlan).where(FollowUpPlan.status.in_(["submitted", "risk_scored"]))
    if current_user.role == "doctor":
        query = query.where(FollowUpPlan.doctor_id == current_user.linked_id)
    result = await db.execute(query.order_by(FollowUpPlan.due_at.desc()))
    return [model_to_dict(row) for row in result.scalars().all()]


@router.post("/follow-ups/{plan_id}/responses")
async def submit_follow_up_response(
    plan_id: str,
    data: FollowUpResponseRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FollowUpPlan).where(FollowUpPlan.id == uuid.UUID(plan_id)))
    plan = result.scalar_one_or_none()
    if not plan or plan.patient_id != current_user.linked_id:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    response = FollowUpResponse(
        follow_up_plan_id=plan.id,
        patient_id=plan.patient_id,
        symptoms=data.symptoms,
        medication_adherence=data.medication_adherence,
        recovery_status=data.recovery_status,
        answers=data.answers or {},
    )
    plan.status = "submitted"
    db.add(response)
    await db.flush()
    await audit_action(db, current_user, "follow_up.submitted", "follow_up_response", str(response.id), plan.patient_id)
    await notify(db, "Follow-up submitted", "A patient follow-up needs review", "follow_up", role="doctor", patient_id=plan.patient_id)
    return model_to_dict(response)


@router.post("/follow-ups/{plan_id}/risk-score")
async def score_follow_up(
    plan_id: str,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    plan_result = await db.execute(select(FollowUpPlan).where(FollowUpPlan.id == uuid.UUID(plan_id)))
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    response_result = await db.execute(
        select(FollowUpResponse)
        .where(FollowUpResponse.follow_up_plan_id == plan.id)
        .order_by(FollowUpResponse.created_at.desc())
    )
    response = response_result.scalar_one_or_none()
    symptoms = (response.symptoms if response else "") or ""
    adherence = (response.medication_adherence if response else "") or ""
    risk_level = "high" if any(term in symptoms.lower() for term in ["chest pain", "bleeding", "fever", "breath"]) else "low"
    if "miss" in adherence.lower() and risk_level == "low":
        risk_level = "medium"
    assessment = AiRiskAssessment(
        patient_id=plan.patient_id,
        source_type="follow_up",
        source_id=str(plan.id),
        risk_level=risk_level,
        confidence_score=0.72,
        ai_summary=f"Follow-up indicates {risk_level} risk based on symptoms and adherence.",
        escalation_recommendations="Escalate to doctor review." if risk_level in {"medium", "high"} else "Continue routine monitoring.",
    )
    plan.status = "risk_scored"
    db.add(assessment)
    await audit_action(db, current_user, "follow_up.risk_scored", "ai_risk_assessment", str(assessment.id), plan.patient_id)
    return model_to_dict(assessment)


@router.patch("/follow-ups/{plan_id}/review")
async def review_follow_up(
    plan_id: str,
    data: StatusUpdateRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FollowUpPlan).where(FollowUpPlan.id == uuid.UUID(plan_id)))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    plan.status = data.status
    await audit_action(db, current_user, "follow_up.reviewed", "follow_up_plan", str(plan.id), plan.patient_id, {"notes": data.notes})
    return model_to_dict(plan)


@router.get("/medications/timeline/{patient_id}")
async def medication_timeline(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resolved_patient_id = await resolve_patient_id(db, current_user, patient_id)
    rx_result = await db.execute(select(Prescription).where(Prescription.patient_id == resolved_patient_id))
    for prescription in rx_result.scalars().all():
        await sync_medication_timeline_from_prescription(db, prescription)
    result = await db.execute(
        select(MedicationTimelineItem)
        .where(MedicationTimelineItem.patient_id == resolved_patient_id)
        .order_by(MedicationTimelineItem.created_at.desc())
    )
    await audit_action(db, current_user, "medication_timeline.read", "patient", str(resolved_patient_id), resolved_patient_id)
    return [model_to_dict(row) for row in result.scalars().all()]


@router.post("/devices/dispensers")
async def register_dispenser(
    data: DeviceRegisterRequest,
    current_user: User = Depends(require_role("patient", "doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    patient_id = await resolve_patient_id(db, current_user, data.patient_id)
    device = MedicationDispenserDevice(
        patient_id=patient_id,
        device_identifier=data.device_identifier,
        label=data.label,
        metadata_json=data.metadata or {},
    )
    db.add(device)
    await db.flush()
    await audit_action(db, current_user, "dispenser.registered", "dispenser", str(device.id), patient_id)
    return model_to_dict(device)


@router.post("/devices/dispensers/{device_id}/sync")
async def sync_dispenser(
    device_id: str,
    current_user: User = Depends(require_role("patient", "doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MedicationDispenserDevice).where(MedicationDispenserDevice.id == uuid.UUID(device_id)))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    timeline_result = await db.execute(
        select(MedicationTimelineItem).where(
            and_(MedicationTimelineItem.patient_id == device.patient_id, MedicationTimelineItem.status == "active")
        )
    )
    device.last_sync_at = utcnow()
    schedule = [model_to_dict(item) for item in timeline_result.scalars().all()]
    await audit_action(db, current_user, "dispenser.synced", "dispenser", device_id, device.patient_id, {"items": len(schedule)})
    return {"device": model_to_dict(device), "schedule": schedule}


@router.post("/devices/dispensers/{device_id}/events")
async def ingest_dispenser_event(
    device_id: str,
    data: AdherenceEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event = MedicationAdherenceEvent(
        patient_id=uuid.UUID(data.patient_id),
        device_id=uuid.UUID(device_id),
        medication_timeline_item_id=uuid.UUID(data.medication_timeline_item_id) if data.medication_timeline_item_id else None,
        event_type=data.event_type,
        scheduled_for=data.scheduled_for,
        payload=data.payload or {},
    )
    db.add(event)
    await db.flush()
    if data.event_type == "missed":
        await notify(db, "Missed dose", "A scheduled medication dose was missed", "medication", patient_id=event.patient_id, priority="high")
    await audit_action(db, current_user, "adherence_event.created", "adherence_event", str(event.id), event.patient_id)
    return model_to_dict(event)


@router.get("/appointments/{appointment_id}/wait-prediction")
async def appointment_wait_prediction(
    appointment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Appointment).where(Appointment.id == uuid.UUID(appointment_id)))
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    prediction = await predict_wait_time(db, appointment)
    await db.flush()
    await audit_action(db, current_user, "wait_prediction.created", "appointment", appointment_id, appointment.patient_id)
    return model_to_dict(prediction)


@router.post("/appointments/waitlist")
async def create_waitlist_entry(
    data: WaitlistRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    entry = AppointmentWaitlistEntry(
        patient_id=current_user.linked_id,
        appointment_id=uuid.UUID(data.appointment_id) if data.appointment_id else None,
        doctor_id=uuid.UUID(data.doctor_id) if data.doctor_id else None,
        specialty=data.specialty,
        earliest_acceptable_at=data.earliest_acceptable_at,
    )
    db.add(entry)
    await db.flush()
    await audit_action(db, current_user, "waitlist.created", "waitlist_entry", str(entry.id), current_user.linked_id)
    return model_to_dict(entry)


@router.get("/appointments/waitlist/my")
async def my_waitlist(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AppointmentWaitlistEntry)
        .where(AppointmentWaitlistEntry.patient_id == current_user.linked_id)
        .order_by(AppointmentWaitlistEntry.created_at.desc())
    )
    return [model_to_dict(row) for row in result.scalars().all()]


@router.post("/appointments/offers")
async def create_earlier_slot_offer(
    data: EarlierOfferRequest,
    current_user: User = Depends(require_role("receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    offer = EarlierSlotOffer(
        waitlist_entry_id=uuid.UUID(data.waitlist_entry_id),
        doctor_id=uuid.UUID(data.doctor_id),
        offered_slot_at=data.offered_slot_at,
        expires_at=data.expires_at or utcnow() + timedelta(minutes=15),
    )
    db.add(offer)
    await db.flush()
    entry_result = await db.execute(select(AppointmentWaitlistEntry).where(AppointmentWaitlistEntry.id == offer.waitlist_entry_id))
    entry = entry_result.scalar_one_or_none()
    if entry:
        await notify(db, "Earlier appointment available", "An earlier appointment slot is available.", "appointment_offer", patient_id=entry.patient_id, payload={"offer_id": str(offer.id)})
    return model_to_dict(offer)


@router.post("/appointments/offers/{offer_id}/accept")
async def accept_earlier_slot_offer(
    offer_id: str,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(EarlierSlotOffer).where(EarlierSlotOffer.id == uuid.UUID(offer_id)))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    entry_result = await db.execute(select(AppointmentWaitlistEntry).where(AppointmentWaitlistEntry.id == offer.waitlist_entry_id))
    entry = entry_result.scalar_one_or_none()
    if not entry or entry.patient_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Offer is not available for this patient")
    offer.status = "accepted"
    entry.status = "accepted"
    if entry.appointment_id:
        appointment_result = await db.execute(select(Appointment).where(Appointment.id == entry.appointment_id))
        appointment = appointment_result.scalar_one_or_none()
        if appointment:
            appointment.scheduled_at = offer.offered_slot_at
            appointment.doctor_id = offer.doctor_id
    await audit_action(db, current_user, "earlier_slot.accepted", "earlier_slot_offer", offer_id, entry.patient_id)
    return model_to_dict(offer)


@router.get("/appointments/{appointment_id}/recovery-options")
async def cancellation_recovery_options(
    appointment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Appointment).where(Appointment.id == uuid.UUID(appointment_id)))
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    doctor_result = await db.execute(select(Doctor).where(Doctor.id == appointment.doctor_id))
    doctor = doctor_result.scalar_one_or_none()
    alt_result = await db.execute(select(Doctor).where(Doctor.department == doctor.department if doctor else True).limit(5))
    alternatives = [
        {
            "doctor_id": str(d.id),
            "name": d.name,
            "specialty": d.specialization,
            "department": d.department,
            "consultation_fee": 500,
            "earliest_slot": (utcnow() + timedelta(days=1)).isoformat(),
        }
        for d in alt_result.scalars().all()
    ]
    return {
        "same_doctor": {
            "doctor_id": str(appointment.doctor_id),
            "name": doctor.name if doctor else "Unknown",
            "earliest_slot": (utcnow() + timedelta(days=1)).isoformat(),
        },
        "alternative_doctors": alternatives,
    }


@router.post("/rooms")
async def create_room(
    data: RoomRequest,
    current_user: User = Depends(require_role("receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    room = Room(**data.model_dump())
    db.add(room)
    await db.flush()
    await audit_action(db, current_user, "room.created", "room", str(room.id))
    return model_to_dict(room)


@router.post("/beds")
async def create_bed(
    data: BedRequest,
    current_user: User = Depends(require_role("receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    bed = Bed(room_id=uuid.UUID(data.room_id), bed_number=data.bed_number, bed_type=data.bed_type, status=data.status)
    db.add(bed)
    await db.flush()
    return model_to_dict(bed)


@router.get("/rooms/availability")
async def room_availability(
    current_user: User = Depends(require_role("receptionist", "doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    rooms = (await db.execute(select(Room).order_by(Room.room_number))).scalars().all()
    beds = (await db.execute(select(Bed))).scalars().all()
    return {
        "rooms": [model_to_dict(room) for room in rooms],
        "beds": [model_to_dict(bed) for bed in beds],
        "summary": {
            "total_rooms": len(rooms),
            "available_rooms": len([r for r in rooms if r.status == "available"]),
            "total_beds": len(beds),
            "available_beds": len([b for b in beds if b.status == "available"]),
            "icu_occupied": len([b for b in beds if b.bed_type.lower() == "icu" and b.status == "occupied"]),
        },
    }


@router.get("/rooms/public-availability")
async def public_room_availability(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).where(Room.status == "available").order_by(Room.price_per_day.asc()))
    return [model_to_dict(row) for row in result.scalars().all()]


@router.patch("/beds/{bed_id}/status")
async def update_bed_status(
    bed_id: str,
    data: BedStatusRequest,
    current_user: User = Depends(require_role("receptionist", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Bed).where(Bed.id == uuid.UUID(bed_id)))
    bed = result.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")
    bed.status = data.status
    bed.current_patient_id = uuid.UUID(data.current_patient_id) if data.current_patient_id else None
    await audit_action(db, current_user, "bed.status_updated", "bed", bed_id, bed.current_patient_id)
    return model_to_dict(bed)


@router.get("/prescriptions/{prescription_id}/cost-analysis")
async def prescription_cost_analysis(
    prescription_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Prescription).where(Prescription.id == uuid.UUID(prescription_id)))
    prescription = result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    analysis = await calculate_prescription_cost(db, prescription)
    await db.flush()
    await audit_action(db, current_user, "prescription.cost_analysis", "prescription", prescription_id, prescription.patient_id)
    return model_to_dict(analysis)


@router.post("/prescriptions/{prescription_id}/substitution-requests")
async def create_substitution_request(
    prescription_id: str,
    data: SubstitutionRequestBody,
    current_user: User = Depends(require_role("patient", "pharmacist")),
    db: AsyncSession = Depends(get_db),
):
    rx_result = await db.execute(select(Prescription).where(Prescription.id == uuid.UUID(prescription_id)))
    prescription = rx_result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    request = SubstitutionRequest(
        prescription_id=prescription.id,
        requested_by_user_id=current_user.id,
        doctor_id=prescription.doctor_id,
        original_medicine=data.original_medicine,
        substitute_medicine=data.substitute_medicine,
        reason=data.reason,
    )
    db.add(request)
    await db.flush()
    await notify(db, "Medication substitution request", "A substitute medicine needs approval.", "medication", role="doctor", patient_id=prescription.patient_id)
    return model_to_dict(request)


@router.patch("/substitution-requests/{request_id}/approve")
async def approve_substitution_request(
    request_id: str,
    data: StatusUpdateRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SubstitutionRequest).where(SubstitutionRequest.id == uuid.UUID(request_id)))
    request = result.scalar_one_or_none()
    if not request:
        raise HTTPException(status_code=404, detail="Substitution request not found")
    request.status = data.status
    request.decision_notes = data.notes
    request.decided_at = utcnow()
    await audit_action(db, current_user, "substitution.decided", "substitution_request", request_id)
    return model_to_dict(request)


@router.post("/families")
async def create_family(
    data: FamilyGroupRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    group = FamilyGroup(name=data.name, owner_user_id=current_user.id)
    db.add(group)
    await db.flush()
    return model_to_dict(group)


@router.post("/families/{family_id}/members")
async def add_family_member(
    family_id: str,
    data: FamilyMemberRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    member = FamilyMember(
        family_group_id=uuid.UUID(family_id),
        patient_id=uuid.UUID(data.patient_id),
        relationship=data.relationship,
        access_level=data.access_level,
    )
    db.add(member)
    await db.flush()
    await audit_action(db, current_user, "family.member_added", "family_member", str(member.id), member.patient_id)
    return model_to_dict(member)


@router.get("/families/my")
async def my_families(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    groups = (await db.execute(select(FamilyGroup).where(FamilyGroup.owner_user_id == current_user.id))).scalars().all()
    return [model_to_dict(group) for group in groups]


@router.post("/insurance/policies")
async def create_insurance_policy(
    data: InsurancePolicyRequest,
    current_user: User = Depends(require_role("patient", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    patient_id = await resolve_patient_id(db, current_user, data.patient_id)
    policy = InsurancePolicy(
        patient_id=patient_id,
        provider=data.provider,
        policy_number=data.policy_number,
        policy_type=data.policy_type,
        coverage_info=data.coverage_info or {},
    )
    db.add(policy)
    await db.flush()
    await audit_action(db, current_user, "insurance.policy_created", "insurance_policy", str(policy.id), patient_id)
    return model_to_dict(policy)


@router.get("/insurance/policies")
async def list_insurance_policies(
    patient_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resolved_patient_id = await resolve_patient_id(db, current_user, patient_id)
    result = await db.execute(select(InsurancePolicy).where(InsurancePolicy.patient_id == resolved_patient_id))
    return [model_to_dict(row) for row in result.scalars().all()]


@router.post("/insurance/eligibility-checks")
async def create_eligibility_check(
    data: EligibilityRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    coverage = round(data.estimate_amount * 0.7, 2)
    check = EligibilityCheck(
        insurance_policy_id=uuid.UUID(data.insurance_policy_id),
        service_type=data.service_type,
        estimate_amount=data.estimate_amount,
        coverage_estimate=coverage,
        result={"patient_pay_estimate": round(data.estimate_amount - coverage, 2), "method": "mvp_estimate"},
    )
    db.add(check)
    await db.flush()
    return model_to_dict(check)


@router.post("/insurance/claims")
async def create_claim(
    data: ClaimRequest,
    current_user: User = Depends(require_role("patient", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    claim = InsuranceClaim(
        insurance_policy_id=uuid.UUID(data.insurance_policy_id),
        bill_id=uuid.UUID(data.bill_id) if data.bill_id else None,
        claim_number=data.claim_number,
        amount=data.amount,
        metadata_json=data.metadata or {},
    )
    db.add(claim)
    await db.flush()
    return model_to_dict(claim)


@router.post("/assistant/conversations")
async def start_assistant_conversation(
    data: AssistantConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = AssistantConversation(patient_id=current_user.linked_id, user_id=current_user.id, topic=data.topic)
    db.add(conversation)
    await db.flush()
    return model_to_dict(conversation)


@router.post("/assistant/conversations/{conversation_id}/messages")
async def send_assistant_message(
    conversation_id: str,
    data: AssistantMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_message = AssistantMessage(conversation_id=uuid.UUID(conversation_id), sender_type="user", message=data.message)
    db.add(user_message)
    response_text = await ai_chat_response(data.message, {"role": current_user.role})
    assistant_message = AssistantMessage(
        conversation_id=uuid.UUID(conversation_id),
        sender_type="assistant",
        message=response_text,
        metadata_json={"escalate_if_unresolved": True},
    )
    db.add(assistant_message)
    await db.flush()
    return {"user_message": model_to_dict(user_message), "assistant_message": model_to_dict(assistant_message)}


@router.post("/assistant/conversations/{conversation_id}/escalate")
async def escalate_assistant_conversation(
    conversation_id: str,
    data: StaffEscalationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = StaffEscalationTicket(
        patient_id=current_user.linked_id,
        source_type=data.source_type,
        source_id=data.source_id or conversation_id,
        assigned_role=data.assigned_role,
        summary=data.summary,
    )
    db.add(ticket)
    await db.flush()
    await notify(db, "Patient assistant escalation", data.summary, "assistant_escalation", role=data.assigned_role, patient_id=current_user.linked_id)
    return model_to_dict(ticket)


@router.post("/profile/entries")
async def create_profile_entry(
    data: ProfileEntryRequest,
    current_user: User = Depends(require_role("patient", "doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    patient_id = await resolve_patient_id(db, current_user, data.patient_id)
    entry = PatientProfileEntry(
        patient_id=patient_id,
        entry_type=data.entry_type,
        title=data.title,
        details=data.details,
        occurred_at=data.occurred_at,
        metadata_json=data.metadata or {},
    )
    db.add(entry)
    await db.flush()
    await audit_action(db, current_user, "patient_profile.entry_created", "patient_profile_entry", str(entry.id), patient_id)
    return model_to_dict(entry)


@router.get("/profile/{patient_id}")
async def comprehensive_profile(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resolved_patient_id = await resolve_patient_id(db, current_user, patient_id)
    patient = await get_patient_or_404(db, resolved_patient_id)
    entries = (await db.execute(select(PatientProfileEntry).where(PatientProfileEntry.patient_id == resolved_patient_id))).scalars().all()
    vitals = (await db.execute(select(PatientVital).where(PatientVital.patient_id == resolved_patient_id).order_by(PatientVital.recorded_at.desc()))).scalars().all()
    reports = (await db.execute(select(Report).where(Report.patient_id == resolved_patient_id).order_by(Report.created_at.desc()))).scalars().all()
    await audit_action(db, current_user, "patient_profile.read", "patient", str(resolved_patient_id), resolved_patient_id)
    return {
        "patient": {
            "id": str(patient.id),
            "pid": patient.pid,
            "name": patient.name,
            "blood_group": patient.blood_group,
            "allergies": patient.allergies,
        },
        "entries": [model_to_dict(row) for row in entries],
        "vitals": [model_to_dict(row) for row in vitals],
        "reports": [model_to_dict(row) for row in reports],
    }


@router.post("/profile/vitals")
async def create_vital(
    data: VitalRequest,
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    patient_id = await resolve_patient_id(db, current_user, data.patient_id)
    vital = PatientVital(
        patient_id=patient_id,
        recorded_by_user_id=current_user.id,
        vital_type=data.vital_type,
        value=data.value,
        unit=data.unit,
        recorded_at=data.recorded_at or utcnow(),
    )
    db.add(vital)
    await db.flush()
    return model_to_dict(vital)


@router.post("/qr-access/tokens")
async def create_qr_access_token(
    data: QrTokenRequest,
    current_user: User = Depends(require_role("patient", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    patient_id = await resolve_patient_id(db, current_user, data.patient_id)
    token = QrAccessToken(
        patient_id=patient_id,
        token=token_urlsafe(32),
        scope=data.scope,
        expires_at=data.expires_at,
        created_by_user_id=current_user.id,
    )
    db.add(token)
    await db.flush()
    return model_to_dict(token)


@router.get("/qr-access/{token}")
async def read_qr_access_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(QrAccessToken).where(QrAccessToken.token == token))
    access_token = result.scalar_one_or_none()
    if not access_token or access_token.revoked_at or (access_token.expires_at and access_token.expires_at < utcnow()):
        raise HTTPException(status_code=404, detail="QR access token not found or expired")
    patient = await get_patient_or_404(db, access_token.patient_id)
    await audit_action(db, None, "qr_access.read", "qr_access_token", str(access_token.id), patient.id)
    return {
        "pid": patient.pid,
        "name": patient.name,
        "blood_group": patient.blood_group,
        "allergies": patient.allergies,
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
    }


@router.post("/reports/{report_id}/share")
async def share_report(
    report_id: str,
    data: ReportShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    patient_id = await resolve_patient_id(db, current_user, data.patient_id)
    share = ReportShare(
        report_id=uuid.UUID(report_id),
        patient_id=patient_id,
        shared_by_user_id=current_user.id,
        token=token_urlsafe(32),
        expires_at=data.expires_at,
    )
    db.add(share)
    await db.flush()
    await audit_action(db, current_user, "report.shared", "report", report_id, patient_id)
    return model_to_dict(share)


@router.post("/care-teams")
async def create_care_team(
    data: CareTeamRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    team = CareTeam(patient_id=uuid.UUID(data.patient_id), name=data.name, owner_doctor_id=current_user.linked_id)
    db.add(team)
    await db.flush()
    if current_user.linked_id:
        db.add(CareTeamMember(care_team_id=team.id, doctor_id=current_user.linked_id, user_id=current_user.id, role="owner"))
    await audit_action(db, current_user, "care_team.created", "care_team", str(team.id), team.patient_id)
    return model_to_dict(team)


@router.post("/care-teams/{team_id}/members")
async def add_care_team_member(
    team_id: str,
    data: CareMemberRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    member = CareTeamMember(
        care_team_id=uuid.UUID(team_id),
        doctor_id=uuid.UUID(data.doctor_id) if data.doctor_id else None,
        user_id=uuid.UUID(data.user_id) if data.user_id else None,
        role=data.role,
    )
    db.add(member)
    await db.flush()
    return model_to_dict(member)


@router.post("/care-teams/{team_id}/notes")
async def create_care_note(
    team_id: str,
    data: CareNoteRequest,
    current_user: User = Depends(require_role("doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    note = CareNote(care_team_id=uuid.UUID(team_id), author_user_id=current_user.id, note_type=data.note_type, body=data.body)
    db.add(note)
    await db.flush()
    return model_to_dict(note)


@router.post("/care-teams/{team_id}/treatment-plans")
async def create_treatment_plan(
    team_id: str,
    data: TreatmentPlanRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    plan = TreatmentPlan(care_team_id=uuid.UUID(team_id), title=data.title, plan=data.plan or {})
    db.add(plan)
    await db.flush()
    return model_to_dict(plan)


@router.post("/care-teams/referrals")
async def create_referral(
    data: ReferralRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    referral = SpecialistReferral(
        patient_id=uuid.UUID(data.patient_id),
        from_doctor_id=current_user.linked_id,
        to_specialty=data.to_specialty,
        to_doctor_id=uuid.UUID(data.to_doctor_id) if data.to_doctor_id else None,
        reason=data.reason,
    )
    db.add(referral)
    await db.flush()
    return model_to_dict(referral)


@router.post("/journeys")
async def create_journey(
    data: JourneyCreateRequest,
    current_user: User = Depends(require_role("receptionist", "doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    journey = PatientJourney(
        patient_id=uuid.UUID(data.patient_id),
        appointment_id=uuid.UUID(data.appointment_id) if data.appointment_id else None,
    )
    db.add(journey)
    await db.flush()
    first_step_id = None
    for index, step_data in enumerate(data.steps, start=1):
        step = JourneyStep(
            journey_id=journey.id,
            step_order=index,
            name=step_data.get("name", f"Step {index}"),
            department=step_data.get("department"),
            floor=step_data.get("floor"),
            room_number=step_data.get("room_number"),
            estimated_duration_minutes=step_data.get("estimated_duration_minutes"),
            status="current" if index == 1 else "pending",
            started_at=utcnow() if index == 1 else None,
        )
        db.add(step)
        await db.flush()
        first_step_id = first_step_id or step.id
    journey.current_step_id = first_step_id
    await audit_action(db, current_user, "journey.created", "patient_journey", str(journey.id), journey.patient_id)
    return model_to_dict(journey)


@router.patch("/journeys/{journey_id}/steps/{step_id}")
async def update_journey_step(
    journey_id: str,
    step_id: str,
    data: JourneyStepStatusRequest,
    current_user: User = Depends(require_role("receptionist", "doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(JourneyStep).where(JourneyStep.id == uuid.UUID(step_id)))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Journey step not found")
    step.status = data.status
    if data.status == "current":
        step.started_at = step.started_at or utcnow()
        journey_result = await db.execute(select(PatientJourney).where(PatientJourney.id == uuid.UUID(journey_id)))
        journey = journey_result.scalar_one_or_none()
        if journey:
            journey.current_step_id = step.id
    if data.status == "completed":
        step.completed_at = utcnow()
    return model_to_dict(step)


@router.get("/journeys/my/current")
async def my_current_journey(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PatientJourney)
        .where(and_(PatientJourney.patient_id == current_user.linked_id, PatientJourney.status == "active"))
        .order_by(PatientJourney.created_at.desc())
    )
    journey = result.scalar_one_or_none()
    if not journey:
        return None
    steps = (await db.execute(select(JourneyStep).where(JourneyStep.journey_id == journey.id).order_by(JourneyStep.step_order))).scalars().all()
    return {"journey": model_to_dict(journey), "steps": [model_to_dict(step) for step in steps]}


@router.post("/visual-triage/uploads")
async def upload_visual_triage_image(
    patient_id: str = Form(...),
    source_type: str = Form("patient_upload"),
    source_id: str | None = Form(None),
    image_type: str | None = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    resolved_patient_id = await resolve_patient_id(db, current_user, patient_id)
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")
    os.makedirs(settings.uploads_dir, exist_ok=True)
    suffix = os.path.splitext(file.filename or "image.jpg")[1] or ".jpg"
    filename = f"visual_triage_{resolved_patient_id}_{token_urlsafe(12)}{suffix}"
    path = os.path.join(settings.uploads_dir, filename)
    async with aiofiles.open(path, "wb") as out_file:
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image uploads must be 10MB or smaller")
        await out_file.write(content)
    upload = VisualTriageUpload(
        patient_id=resolved_patient_id,
        source_type=source_type,
        source_id=source_id,
        image_path=path,
        image_type=image_type,
        uploaded_by_user_id=current_user.id,
    )
    db.add(upload)
    await db.flush()
    await audit_action(db, current_user, "visual_triage.uploaded", "visual_triage_upload", str(upload.id), resolved_patient_id)
    return model_to_dict(upload)


@router.post("/visual-triage/{upload_id}/analyze")
async def analyze_visual_triage(
    upload_id: str,
    data: VisualAnalysisRequest | None = None,
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(VisualTriageUpload).where(VisualTriageUpload.id == uuid.UUID(upload_id)))
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Visual triage upload not found")
    provided = data or VisualAnalysisRequest()
    concerns = provided.highlighted_concerns or []
    urgency = provided.urgency_level
    if not urgency:
        urgency = "urgent" if any(word in " ".join(concerns).lower() for word in ["bleeding", "infection", "burn"]) else "routine"
    analysis = VisualTriageAnalysis(
        visual_triage_upload_id=upload.id,
        patient_id=upload.patient_id,
        ai_summary=provided.ai_summary or "Image captured for clinical review. MVP analysis generated pending multimodal model integration.",
        visible_abnormalities=provided.visible_abnormalities or [],
        highlighted_concerns=concerns,
        urgency_level=urgency,
        confidence_score=provided.confidence_score or 0.55,
    )
    db.add(analysis)
    await db.flush()
    if urgency in {"urgent", "critical", "life_threatening"}:
        await notify(db, "Visual triage concern", "Uploaded image needs clinical review.", "visual_triage", role="doctor", patient_id=upload.patient_id, priority="high")
    await audit_action(db, current_user, "visual_triage.analyzed", "visual_triage_analysis", str(analysis.id), upload.patient_id)
    return model_to_dict(analysis)


@router.get("/visual-triage/{upload_id}")
async def get_visual_triage(
    upload_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    upload_result = await db.execute(select(VisualTriageUpload).where(VisualTriageUpload.id == uuid.UUID(upload_id)))
    upload = upload_result.scalar_one_or_none()
    if not upload:
        raise HTTPException(status_code=404, detail="Visual triage upload not found")
    analysis_result = await db.execute(
        select(VisualTriageAnalysis)
        .where(VisualTriageAnalysis.visual_triage_upload_id == upload.id)
        .order_by(VisualTriageAnalysis.created_at.desc())
    )
    analyses = analysis_result.scalars().all()
    return {"upload": model_to_dict(upload), "analyses": [model_to_dict(row) for row in analyses]}
