import hashlib
import hmac
import uuid
from datetime import datetime, timezone

import razorpay
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.appointment import Appointment
from app.models.bill import Bill
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.prescription import Prescription
from app.models.user import User
from app.services.enhancements import notify


def _razorpay_client() -> razorpay.Client:
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise ValueError("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str) -> bool:
    body = f"{order_id}|{payment_id}"
    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def get_bill_for_appointment(db: AsyncSession, appointment_id: uuid.UUID) -> Bill | None:
    result = await db.execute(
        select(Bill).where(
            Bill.appointment_id == appointment_id,
            Bill.bill_type == "consultation",
        )
    )
    return result.scalar_one_or_none()


async def create_consultation_bill(
    db: AsyncSession,
    patient_id: uuid.UUID,
    appointment_id: uuid.UUID | None,
    prescription_id: uuid.UUID | None,
    amount: float | None = None,
) -> Bill:
    if appointment_id:
        existing = await get_bill_for_appointment(db, appointment_id)
        if existing:
            if prescription_id and not existing.prescription_id:
                existing.prescription_id = prescription_id
            return existing

    fee = amount if amount is not None else settings.consultation_fee
    tax = round(fee * 0.05, 2)
    total = round(fee + tax, 2)

    bill = Bill(
        patient_id=patient_id,
        appointment_id=appointment_id,
        prescription_id=prescription_id,
        bill_type="consultation",
        items=[
            {
                "description": "Consultation fee",
                "quantity": 1,
                "unit_price": fee,
                "total": fee,
            }
        ],
        subtotal=fee,
        tax=tax,
        total_amount=total,
        payment_status="pending",
    )
    db.add(bill)
    await db.flush()
    return bill


async def get_patient_user(db: AsyncSession, patient_id: uuid.UUID) -> User | None:
    result = await db.execute(
        select(User).where(User.role == "patient", User.linked_id == patient_id)
    )
    return result.scalar_one_or_none()


async def send_payment_link_notification(
    db: AsyncSession,
    bill: Bill,
    doctor_name: str | None = None,
) -> None:
    patient_user = await get_patient_user(db, bill.patient_id)
    amount = float(bill.total_amount)
    doctor_part = f" with {doctor_name}" if doctor_name else ""
    payment_url = f"{settings.frontend_url}/patient/billing?bill={bill.id}"

    await notify(
        db,
        title="Consultation payment due",
        message=f"Your consultation{doctor_part} is complete. Please pay ₹{amount:.2f} to finalize your visit.",
        notification_type="payment",
        user_id=patient_user.id if patient_user else None,
        patient_id=bill.patient_id,
        priority="high",
        payload={
            "bill_id": str(bill.id),
            "amount": amount,
            "payment_url": payment_url,
            "appointment_id": str(bill.appointment_id) if bill.appointment_id else None,
        },
    )
    bill.payment_link_sent_at = datetime.now(timezone.utc)


async def get_patient_pending_bills(db: AsyncSession, patient_id: uuid.UUID) -> list[Bill]:
    result = await db.execute(
        select(Bill)
        .where(
            Bill.patient_id == patient_id,
            Bill.payment_status == "pending",
            Bill.bill_type == "consultation",
        )
        .order_by(Bill.created_at.desc())
    )
    bills = list(result.scalars().all())
    return [
        bill for bill in bills
        if bill.appointment_id is not None
        or any((item or {}).get("description") == "Consultation fee" for item in (bill.items or []))
    ]


async def create_razorpay_order(db: AsyncSession, bill_id: uuid.UUID, patient_id: uuid.UUID) -> dict:
    result = await db.execute(select(Bill).where(Bill.id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        raise ValueError("Bill not found")
    if bill.patient_id != patient_id:
        raise ValueError("Access denied")
    if bill.payment_status != "pending":
        raise ValueError("Bill is already paid or cancelled")

    client = _razorpay_client()
    amount_paise = int(round(float(bill.total_amount) * 100))
    order = client.order.create(
        {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"bill_{str(bill.id)[:8]}",
            "notes": {
                "bill_id": str(bill.id),
                "patient_id": str(bill.patient_id),
                "source": "mediflow",
            },
        }
    )
    bill.razorpay_order_id = order["id"]
    await db.flush()
    return order


async def verify_and_mark_paid(
    db: AsyncSession,
    bill_id: uuid.UUID,
    patient_id: uuid.UUID,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> Bill:
    result = await db.execute(select(Bill).where(Bill.id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        raise ValueError("Bill not found")
    if bill.patient_id != patient_id:
        raise ValueError("Access denied")
    if bill.payment_status == "paid":
        return bill

    if not verify_razorpay_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
        raise ValueError("Payment signature verification failed")

    bill.payment_status = "paid"
    bill.payment_method = "razorpay"
    bill.razorpay_order_id = razorpay_order_id
    bill.razorpay_payment_id = razorpay_payment_id
    await db.flush()
    return bill


def bill_to_dict(bill: Bill, patient: Patient | None = None, doctor: Doctor | None = None) -> dict:
    return {
        "id": str(bill.id),
        "patient_id": str(bill.patient_id),
        "patient_name": patient.name if patient else None,
        "patient_pid": patient.pid if patient else None,
        "appointment_id": str(bill.appointment_id) if bill.appointment_id else None,
        "prescription_id": str(bill.prescription_id) if bill.prescription_id else None,
        "bill_type": bill.bill_type,
        "items": bill.items or [],
        "subtotal": float(bill.subtotal),
        "tax": float(bill.tax),
        "total_amount": float(bill.total_amount),
        "payment_status": bill.payment_status,
        "payment_method": bill.payment_method,
        "razorpay_order_id": bill.razorpay_order_id,
        "payment_link_sent_at": bill.payment_link_sent_at.isoformat() if bill.payment_link_sent_at else None,
        "created_at": bill.created_at.isoformat(),
        "doctor_name": doctor.name if doctor else None,
    }
