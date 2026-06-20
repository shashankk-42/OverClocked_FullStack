import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.guards import require_role
from app.config import settings
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.bill import Bill
from app.models.doctor import Doctor
from app.models.enhancement import PaymentTransaction
from app.models.patient import Patient
from app.models.user import User
from app.services.billing import (
    bill_to_dict,
    create_razorpay_order,
    get_bill_for_appointment,
    get_patient_pending_bills,
    mark_bill_paid_with_transaction,
    send_payment_link_notification,
    verify_and_mark_paid,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


class VerifyPaymentRequest(BaseModel):
    bill_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class OfflinePaymentRequest(BaseModel):
    payment_method: str = "cash"
    gateway_reference: str | None = None


@router.get("/config")
async def billing_config(
    current_user: User = Depends(require_role("patient", "doctor", "admin")),
):
    return {
        "key_id": settings.razorpay_key_id,
        "enabled": bool(settings.razorpay_key_id and settings.razorpay_key_secret),
        "currency": "INR",
    }


@router.get("/my")
async def my_bills(
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    bills = await get_patient_pending_bills(db, current_user.linked_id)
    rows = []
    for bill in bills:
        patient_result = await db.execute(select(Patient).where(Patient.id == bill.patient_id))
        patient = patient_result.scalar_one_or_none()
        doctor = None
        if bill.appointment_id:
            appt_result = await db.execute(select(Appointment).where(Appointment.id == bill.appointment_id))
            appt = appt_result.scalar_one_or_none()
            if appt:
                dr_result = await db.execute(select(Doctor).where(Doctor.id == appt.doctor_id))
                doctor = dr_result.scalar_one_or_none()
        rows.append(bill_to_dict(bill, patient, doctor))
    return rows


@router.get("/appointment/{appointment_id}")
async def bill_by_appointment(
    appointment_id: str,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    appt_result = await db.execute(select(Appointment).where(Appointment.id == uuid.UUID(appointment_id)))
    appt = appt_result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if current_user.role == "doctor" and appt.doctor_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Not your appointment")

    bill = await get_bill_for_appointment(db, appt.id)
    if not bill:
        return {"bill": None}

    patient_result = await db.execute(select(Patient).where(Patient.id == bill.patient_id))
    patient = patient_result.scalar_one_or_none()
    dr_result = await db.execute(select(Doctor).where(Doctor.id == appt.doctor_id))
    doctor = dr_result.scalar_one_or_none()
    return {"bill": bill_to_dict(bill, patient, doctor)}


@router.post("/appointment/{appointment_id}/send-payment-link")
async def send_payment_link(
    appointment_id: str,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: AsyncSession = Depends(get_db),
):
    appt_result = await db.execute(select(Appointment).where(Appointment.id == uuid.UUID(appointment_id)))
    appt = appt_result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if current_user.role == "doctor" and appt.doctor_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Not your appointment")
    if appt.status != "completed":
        raise HTTPException(status_code=400, detail="Consultation must be completed before sending payment link")

    bill = await get_bill_for_appointment(db, appt.id)
    if not bill:
        raise HTTPException(status_code=404, detail="No bill found for this consultation")
    if bill.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Bill is already paid")

    dr_result = await db.execute(select(Doctor).where(Doctor.id == appt.doctor_id))
    doctor = dr_result.scalar_one_or_none()
    await send_payment_link_notification(db, bill, doctor.name if doctor else None)

    return {
        "message": "Payment link sent to patient dashboard",
        "bill_id": str(bill.id),
        "payment_url": f"{settings.frontend_url}/patient/billing?bill={bill.id}",
        "amount": float(bill.total_amount),
    }


@router.post("/{bill_id}/create-order")
async def create_order(
    bill_id: str,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    try:
        order = await create_razorpay_order(db, uuid.UUID(bill_id), current_user.linked_id)
        return {
            "id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": settings.razorpay_key_id,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/{bill_id}/pay")
async def pay_bill(
    bill_id: str,
    data: OfflinePaymentRequest,
    current_user: User = Depends(require_role("patient", "pharmacist", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    allowed_methods = {"cash", "upi", "card", "gateway", "simulated"}
    if data.payment_method not in allowed_methods:
        raise HTTPException(status_code=400, detail=f"Invalid method. Use one of: {', '.join(sorted(allowed_methods))}")

    actor_patient_id = current_user.linked_id if current_user.role == "patient" else None
    try:
        bill, transaction = await mark_bill_paid_with_transaction(
            db,
            uuid.UUID(bill_id),
            data.payment_method,
            actor_patient_id=actor_patient_id,
            gateway_reference=data.gateway_reference,
        )
        return {
            "success": True,
            "bill_id": str(bill.id),
            "transaction_id": transaction.transaction_id,
            "payment_status": bill.payment_status,
            "payment_method": bill.payment_method,
            "total_amount": float(bill.total_amount),
            "receipt": transaction.receipt_payload,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/receipts/{transaction_id}")
async def receipt(
    transaction_id: str,
    current_user: User = Depends(require_role("patient", "pharmacist", "receptionist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PaymentTransaction).where(PaymentTransaction.transaction_id == transaction_id))
    transaction = result.scalar_one_or_none()
    if not transaction:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if current_user.role == "patient" and transaction.patient_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "transaction_id": transaction.transaction_id,
        "bill_id": str(transaction.bill_id),
        "patient_id": str(transaction.patient_id),
        "payment_method": transaction.payment_method,
        "amount": float(transaction.amount),
        "status": transaction.status,
        "created_at": transaction.created_at.isoformat(),
        "receipt": transaction.receipt_payload,
    }


@router.post("/verify")
async def verify_payment(
    data: VerifyPaymentRequest,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    try:
        bill = await verify_and_mark_paid(
            db,
            uuid.UUID(data.bill_id),
            current_user.linked_id,
            data.razorpay_order_id,
            data.razorpay_payment_id,
            data.razorpay_signature,
        )
        return {
            "success": True,
            "bill_id": str(bill.id),
            "payment_status": bill.payment_status,
            "total_amount": float(bill.total_amount),
            "message": "Payment successful",
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
