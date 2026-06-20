import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.auth.guards import require_role
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.prescription import Prescription
from app.models.bill import Bill
from app.services.pharmacy import (
    get_pending_prescriptions, get_inventory, get_low_stock_items,
    dispense_prescription, mark_bill_paid, check_medicine_stock
)
from app.schemas.schemas import PaymentRequest

router = APIRouter(prefix="/pharmacy", tags=["Pharmacy"])


@router.get("/prescriptions/pending")
async def pending_prescriptions(
    current_user: User = Depends(require_role("pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    prescriptions = await get_pending_prescriptions(db)
    result = []
    for rx in prescriptions:
        patient_result = await db.execute(select(Patient).where(Patient.id == rx.patient_id))
        patient = patient_result.scalar_one_or_none()
        dr_result = await db.execute(select(Doctor).where(Doctor.id == rx.doctor_id))
        doctor = dr_result.scalar_one_or_none()
        result.append({
            "id": str(rx.id),
            "patient_name": patient.name if patient else "Unknown",
            "patient_pid": patient.pid if patient else "",
            "doctor_name": doctor.name if doctor else "Unknown",
            "diagnosis": rx.diagnosis,
            "medicines": rx.medicines,
            "status": rx.status,
            "created_at": rx.created_at.isoformat(),
        })
    return result


@router.post("/dispense/{prescription_id}")
async def dispense(
    prescription_id: str,
    current_user: User = Depends(require_role("pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await dispense_prescription(db, uuid.UUID(prescription_id))
        bill = result["bill"]
        return {
            "bill_id": str(bill.id),
            "total_amount": float(bill.total_amount),
            "items": bill.items,
            "message": "Prescription dispensed. Bill created.",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pay")
async def process_payment(
    data: PaymentRequest,
    current_user: User = Depends(require_role("pharmacist", "admin", "patient")),
    db: AsyncSession = Depends(get_db),
):
    try:
        bill = await mark_bill_paid(db, uuid.UUID(data.bill_id), data.payment_method)
        return {
            "bill_id": str(bill.id),
            "payment_status": bill.payment_status,
            "total_amount": float(bill.total_amount),
            "message": "Payment successful! Receipt generated.",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/inventory")
async def inventory(
    current_user: User = Depends(require_role("pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    items = await get_inventory(db)
    return [
        {
            "id": str(i.id),
            "medicine_name": i.medicine_name,
            "generic_name": i.generic_name,
            "category": i.category,
            "stock": i.stock,
            "unit": i.unit,
            "price_per_unit": float(i.price_per_unit),
            "low_stock_threshold": i.low_stock_threshold,
            "is_low_stock": i.stock <= i.low_stock_threshold,
        }
        for i in items
    ]


@router.get("/inventory/low-stock")
async def low_stock(
    current_user: User = Depends(require_role("pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    items = await get_low_stock_items(db)
    return [
        {
            "id": str(i.id),
            "medicine_name": i.medicine_name,
            "stock": i.stock,
            "low_stock_threshold": i.low_stock_threshold,
            "unit": i.unit,
        }
        for i in items
    ]


@router.get("/bills/{patient_id}")
async def patient_bills(
    patient_id: str,
    current_user: User = Depends(require_role("pharmacist", "admin", "patient")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bill).where(Bill.patient_id == uuid.UUID(patient_id))
        .order_by(Bill.created_at.desc())
    )
    bills = result.scalars().all()
    return [
        {
            "id": str(b.id),
            "patient_id": str(b.patient_id),
            "prescription_id": str(b.prescription_id) if b.prescription_id else None,
            "total_amount": float(b.total_amount),
            "subtotal": float(b.subtotal),
            "tax": float(b.tax),
            "payment_status": b.payment_status,
            "payment_method": b.payment_method,
            "items": b.items,
            "created_at": b.created_at.isoformat(),
        }
        for b in bills
    ]


@router.get("/bills")
async def all_bills(
    current_user: User = Depends(require_role("pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Bill).order_by(Bill.created_at.desc()))
    bills = result.scalars().all()
    rows = []
    for b in bills:
        patient_result = await db.execute(select(Patient).where(Patient.id == b.patient_id))
        patient = patient_result.scalar_one_or_none()
        rows.append({
            "id": str(b.id),
            "patient_id": str(b.patient_id),
            "patient_name": patient.name if patient else "Unknown",
            "patient_pid": patient.pid if patient else "",
            "prescription_id": str(b.prescription_id) if b.prescription_id else None,
            "items": b.items or [],
            "subtotal": float(b.subtotal),
            "tax": float(b.tax),
            "total_amount": float(b.total_amount),
            "payment_status": b.payment_status,
            "payment_method": b.payment_method,
            "created_at": b.created_at.isoformat(),
        })
    return rows
