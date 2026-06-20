import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.auth.guards import require_role
from app.models.user import User
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.models.enhancement import PharmacyOrder
from app.models.prescription import Prescription
from app.models.bill import Bill
from app.models.pharmacy import PharmacyItem
from app.services.pharmacy import (
    get_pending_prescriptions, get_inventory, get_low_stock_items,
    dispense_prescription, mark_bill_paid, check_medicine_stock
)
from app.services.enhancements import notify
from app.schemas.schemas import PaymentRequest

router = APIRouter(prefix="/pharmacy", tags=["Pharmacy"])


class PharmacyOrderStatusRequest(BaseModel):
    status: str
    notes: str | None = None


async def _pharmacy_order_dict(db: AsyncSession, order: PharmacyOrder) -> dict:
    rx_result = await db.execute(select(Prescription).where(Prescription.id == order.prescription_id))
    rx = rx_result.scalar_one_or_none()
    patient_result = await db.execute(select(Patient).where(Patient.id == order.patient_id))
    patient = patient_result.scalar_one_or_none()
    doctor = None
    if rx:
        doctor_result = await db.execute(select(Doctor).where(Doctor.id == rx.doctor_id))
        doctor = doctor_result.scalar_one_or_none()
    bill = None
    if order.bill_id:
        bill_result = await db.execute(select(Bill).where(Bill.id == order.bill_id))
        bill = bill_result.scalar_one_or_none()
    return {
        "id": str(order.id),
        "prescription_id": str(order.prescription_id),
        "patient_id": str(order.patient_id),
        "patient_name": patient.name if patient else "Unknown",
        "patient_pid": patient.pid if patient else "",
        "doctor_name": doctor.name if doctor else "Unknown",
        "diagnosis": rx.diagnosis if rx else None,
        "medicines": rx.medicines if rx else [],
        "status": order.status,
        "bill_id": str(order.bill_id) if order.bill_id else None,
        "bill": {
            "id": str(bill.id),
            "total_amount": float(bill.total_amount),
            "payment_status": bill.payment_status,
            "payment_method": bill.payment_method,
            "items": bill.items or [],
        } if bill else None,
        "approved_at": order.approved_at.isoformat() if order.approved_at else None,
        "prepared_at": order.prepared_at.isoformat() if order.prepared_at else None,
        "ready_at": order.ready_at.isoformat() if order.ready_at else None,
        "fulfilled_at": order.fulfilled_at.isoformat() if order.fulfilled_at else None,
        "notes": order.notes,
        "created_at": order.created_at.isoformat(),
    }


async def _create_pharmacy_bill(db: AsyncSession, order: PharmacyOrder, prescription: Prescription) -> Bill:
    if order.bill_id:
        bill_result = await db.execute(select(Bill).where(Bill.id == order.bill_id))
        existing = bill_result.scalar_one_or_none()
        if existing:
            return existing

    total = 0.0
    bill_items = []
    for medicine in prescription.medicines or []:
        med_name = medicine.get("name", "")
        quantity = int(medicine.get("quantity", 10) or 10)
        item_result = await db.execute(select(PharmacyItem).where(PharmacyItem.medicine_name.ilike(f"%{med_name}%")))
        inventory_item = item_result.scalar_one_or_none()
        if inventory_item and inventory_item.stock < quantity:
            raise ValueError(f"Insufficient stock for {inventory_item.medicine_name}")
        unit_price = float(inventory_item.price_per_unit) if inventory_item else 10.0
        line_total = round(unit_price * quantity, 2)
        bill_items.append(
            {
                "medicine_name": med_name,
                "quantity": quantity,
                "unit_price": unit_price,
                "total": line_total,
            }
        )
        total += line_total

    if not bill_items:
        raise ValueError("Prescription has no medicines to bill")

    tax = round(total * 0.05, 2)
    bill = Bill(
        patient_id=order.patient_id,
        prescription_id=order.prescription_id,
        bill_type="pharmacy",
        items=bill_items,
        subtotal=round(total, 2),
        tax=tax,
        total_amount=round(total + tax, 2),
        payment_status="pending",
    )
    db.add(bill)
    await db.flush()
    order.bill_id = bill.id
    return bill


async def _deduct_stock_for_order(db: AsyncSession, prescription: Prescription) -> None:
    for medicine in prescription.medicines or []:
        med_name = medicine.get("name", "")
        quantity = int(medicine.get("quantity", 10) or 10)
        item_result = await db.execute(select(PharmacyItem).where(PharmacyItem.medicine_name.ilike(f"%{med_name}%")))
        inventory_item = item_result.scalar_one_or_none()
        if inventory_item:
            if inventory_item.stock < quantity:
                raise ValueError(f"Insufficient stock for {inventory_item.medicine_name}")
            inventory_item.stock -= quantity


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


@router.get("/orders")
async def pharmacy_orders(
    status: str | None = None,
    current_user: User = Depends(require_role("patient", "pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    query = select(PharmacyOrder)
    if current_user.role == "patient":
        query = query.where(PharmacyOrder.patient_id == current_user.linked_id)
    if status:
        query = query.where(PharmacyOrder.status == status)
    query = query.order_by(PharmacyOrder.created_at.desc())

    result = await db.execute(query)
    return [await _pharmacy_order_dict(db, order) for order in result.scalars().all()]


@router.post("/orders/{order_id}/approve")
async def approve_order(
    order_id: str,
    current_user: User = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PharmacyOrder).where(PharmacyOrder.id == uuid.UUID(order_id)))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pharmacy order not found")
    if order.patient_id != current_user.linked_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if order.status != "patient_review":
        raise HTTPException(status_code=400, detail=f"Order cannot be approved from status '{order.status}'")

    rx_result = await db.execute(select(Prescription).where(Prescription.id == order.prescription_id))
    prescription = rx_result.scalar_one_or_none()
    if prescription:
        prescription.status = "approved_for_pharmacy"

    order.status = "pending"
    order.approved_at = datetime.now(timezone.utc)
    await notify(
        db,
        title="Prescription approved",
        message="Patient approved medicines. Pharmacy can prepare the order.",
        notification_type="pharmacy_order",
        patient_id=order.patient_id,
        priority="medium",
        payload={"order_id": str(order.id), "prescription_id": str(order.prescription_id)},
    )
    await db.flush()
    return await _pharmacy_order_dict(db, order)


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    data: PharmacyOrderStatusRequest,
    current_user: User = Depends(require_role("pharmacist", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PharmacyOrder).where(PharmacyOrder.id == uuid.UUID(order_id)))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Pharmacy order not found")

    rx_result = await db.execute(select(Prescription).where(Prescription.id == order.prescription_id))
    prescription = rx_result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")

    transitions = {
        "pending": {"preparing"},
        "preparing": {"ready_for_pickup"},
        "ready_for_pickup": {"paid"},
        "paid": {"fulfilled"},
        "fulfilled": set(),
        "patient_review": {"pending"},
    }
    if data.status not in transitions:
        raise HTTPException(status_code=400, detail="Invalid pharmacy order status")
    if data.status != order.status and data.status not in transitions.get(order.status, set()):
        raise HTTPException(status_code=400, detail=f"Cannot move order from '{order.status}' to '{data.status}'")

    now = datetime.now(timezone.utc)
    if data.status == "preparing":
        order.prepared_at = now
    elif data.status == "ready_for_pickup":
        try:
            bill = await _create_pharmacy_bill(db, order, prescription)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        order.ready_at = now
        await notify(
            db,
            title="Medicines ready for pickup",
            message=f"Your pharmacy order is ready. Please pay Rs {float(bill.total_amount):.2f}.",
            notification_type="pharmacy_order",
            patient_id=order.patient_id,
            priority="high",
            payload={"order_id": str(order.id), "bill_id": str(bill.id)},
        )
    elif data.status == "fulfilled":
        if not order.bill_id:
            raise HTTPException(status_code=400, detail="Order must have a bill before fulfillment")
        bill_result = await db.execute(select(Bill).where(Bill.id == order.bill_id))
        bill = bill_result.scalar_one_or_none()
        if not bill or bill.payment_status != "paid":
            raise HTTPException(status_code=400, detail="Payment must be completed before fulfillment")
        try:
            await _deduct_stock_for_order(db, prescription)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        order.fulfilled_at = now
        prescription.status = "dispensed"

    order.status = data.status
    if data.notes:
        order.notes = data.notes
    await db.flush()
    return await _pharmacy_order_dict(db, order)


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
