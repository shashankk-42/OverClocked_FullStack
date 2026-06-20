import uuid
from collections import deque

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.guards import require_role
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.enhancement import HospitalLocation, JourneyStep, PatientJourney
from app.models.patient import Patient
from app.models.user import User

router = APIRouter(prefix="/navigation", tags=["Navigation"])


def _location_dict(location: HospitalLocation) -> dict:
    return {
        "id": str(location.id),
        "code": location.code,
        "name": location.name,
        "location_type": location.location_type,
        "department": location.department,
        "floor": location.floor,
        "room_number": location.room_number,
        "x": location.x,
        "y": location.y,
        "adjacent_codes": location.adjacent_codes or [],
        "is_restricted": location.is_restricted,
    }


async def _all_locations(db: AsyncSession) -> list[HospitalLocation]:
    result = await db.execute(select(HospitalLocation).order_by(HospitalLocation.floor, HospitalLocation.name))
    return list(result.scalars().all())


def _find_path(locations: list[HospitalLocation], start_code: str, destination_code: str) -> list[str]:
    by_code = {location.code: location for location in locations}
    if start_code not in by_code or destination_code not in by_code:
        return []
    queue: deque[list[str]] = deque([[start_code]])
    seen = {start_code}
    while queue:
        path = queue.popleft()
        current = path[-1]
        if current == destination_code:
            return path
        for next_code in by_code[current].adjacent_codes or []:
            if next_code not in seen and next_code in by_code:
                seen.add(next_code)
                queue.append([*path, next_code])
    return []


@router.get("/locations")
async def locations(
    q: str | None = None,
    floor: int | None = None,
    location_type: str | None = None,
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    query = select(HospitalLocation)
    if q:
        query = query.where(
            or_(
                HospitalLocation.name.ilike(f"%{q}%"),
                HospitalLocation.department.ilike(f"%{q}%"),
                HospitalLocation.room_number.ilike(f"%{q}%"),
                HospitalLocation.location_type.ilike(f"%{q}%"),
            )
        )
    if floor is not None:
        query = query.where(HospitalLocation.floor == floor)
    if location_type:
        query = query.where(HospitalLocation.location_type == location_type)

    result = await db.execute(query.order_by(HospitalLocation.floor, HospitalLocation.name))
    return [_location_dict(location) for location in result.scalars().all()]


@router.get("/floors")
async def floors(
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    locations = await _all_locations(db)
    grouped: dict[int, list[dict]] = {}
    for location in locations:
        grouped.setdefault(location.floor, []).append(_location_dict(location))
    return [{"floor": floor, "locations": rows} for floor, rows in sorted(grouped.items())]


@router.get("/route")
async def route(
    destination_code: str,
    start_code: str = Query("reception"),
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    locations = await _all_locations(db)
    by_code = {location.code: location for location in locations}
    path_codes = _find_path(locations, start_code, destination_code)
    if not path_codes:
        raise HTTPException(status_code=404, detail="Route not found")

    path = [_location_dict(by_code[code]) for code in path_codes]
    floor_changes = sum(1 for index in range(1, len(path)) if path[index]["floor"] != path[index - 1]["floor"])
    return {
        "start_code": start_code,
        "destination_code": destination_code,
        "path": path,
        "estimated_minutes": max(2, (len(path) - 1) * 2 + floor_changes * 3),
        "floor_changes": floor_changes,
    }


@router.get("/appointment/{appointment_id}")
async def appointment_location(
    appointment_id: str,
    current_user: User = Depends(require_role("patient", "doctor", "nurse", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    appt_result = await db.execute(select(Appointment).where(Appointment.id == uuid.UUID(appointment_id)))
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if current_user.role == "patient" and appointment.patient_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == "doctor" and appointment.doctor_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Access denied")

    doctor_result = await db.execute(select(Doctor).where(Doctor.id == appointment.doctor_id))
    doctor = doctor_result.scalar_one_or_none()
    location = None
    if doctor:
        loc_result = await db.execute(
            select(HospitalLocation)
            .where(HospitalLocation.department.ilike(f"%{doctor.department}%"))
            .order_by(HospitalLocation.location_type.desc())
            .limit(1)
        )
        location = loc_result.scalar_one_or_none()

    if not location:
        loc_result = await db.execute(select(HospitalLocation).where(HospitalLocation.code == "opd-101"))
        location = loc_result.scalar_one_or_none()

    return {
        "appointment_id": str(appointment.id),
        "status": appointment.status,
        "scheduled_at": appointment.scheduled_at.isoformat(),
        "doctor_name": doctor.name if doctor else None,
        "department": doctor.department if doctor else None,
        "location": _location_dict(location) if location else None,
    }


@router.get("/journey/current")
async def current_journey_navigation(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    journey_result = await db.execute(
        select(PatientJourney)
        .where(PatientJourney.patient_id == current_user.linked_id, PatientJourney.status == "active")
        .order_by(PatientJourney.created_at.desc())
        .limit(1)
    )
    journey = journey_result.scalar_one_or_none()
    if not journey:
        return {"journey": None, "current_location": None}

    steps_result = await db.execute(
        select(JourneyStep)
        .where(JourneyStep.journey_id == journey.id)
        .order_by(JourneyStep.step_order)
    )
    steps = list(steps_result.scalars().all())
    active_step = next((step for step in steps if step.status in {"active", "in_progress"}), None) or next(
        (step for step in steps if step.status == "pending"),
        None,
    )
    location = None
    if active_step:
        loc_query = select(HospitalLocation)
        if active_step.room_number:
            loc_query = loc_query.where(HospitalLocation.room_number == active_step.room_number)
        elif active_step.department:
            loc_query = loc_query.where(HospitalLocation.department.ilike(f"%{active_step.department}%"))
        loc_result = await db.execute(loc_query.limit(1))
        location = loc_result.scalar_one_or_none()

    return {
        "journey": str(journey.id),
        "current_step": active_step.name if active_step else None,
        "current_location": _location_dict(location) if location else None,
        "steps": [
            {
                "id": str(step.id),
                "name": step.name,
                "department": step.department,
                "floor": step.floor,
                "room_number": step.room_number,
                "estimated_duration_minutes": step.estimated_duration_minutes,
                "status": step.status,
            }
            for step in steps
        ],
    }
