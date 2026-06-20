import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.pharmacy import PharmacyItem
from app.models.prescription import Prescription
from app.models.bill import Bill


async def get_pending_prescriptions(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(Prescription).where(Prescription.status == "pending")
        .order_by(Prescription.created_at.asc())
    )
    return list(result.scalars().all())


async def get_inventory(db: AsyncSession) -> list[PharmacyItem]:
    result = await db.execute(
        select(PharmacyItem).order_by(PharmacyItem.medicine_name)
    )
    return list(result.scalars().all())


async def get_low_stock_items(db: AsyncSession) -> list[PharmacyItem]:
    result = await db.execute(
        select(PharmacyItem).where(
            PharmacyItem.stock <= PharmacyItem.low_stock_threshold
        )
    )
    return list(result.scalars().all())


async def dispense_prescription(
    db: AsyncSession,
    prescription_id: uuid.UUID,
) -> dict:
    """Dispense all medicines in a prescription and create a bill."""
    rx_result = await db.execute(
        select(Prescription).where(Prescription.id == prescription_id)
    )
    prescription = rx_result.scalar_one_or_none()
    if not prescription:
        raise ValueError("Prescription not found")
    if prescription.status == "dispensed":
        raise ValueError("Prescription already dispensed")

    medicines = prescription.medicines or []
    bill_items = []
    total = 0.0

    for medicine in medicines:
        med_name = medicine.get("name", "")
        quantity = int(medicine.get("quantity", 10))

        # Look up in inventory
        inv_result = await db.execute(
            select(PharmacyItem).where(
                PharmacyItem.medicine_name.ilike(f"%{med_name}%")
            )
        )
        inv_item = inv_result.scalar_one_or_none()

        unit_price = float(inv_item.price_per_unit) if inv_item else 10.0
        line_total = unit_price * quantity

        # Deduct stock if available
        if inv_item and inv_item.stock >= quantity:
            inv_item.stock -= quantity

        bill_items.append({
            "medicine_name": med_name,
            "quantity": quantity,
            "unit_price": unit_price,
            "total": line_total,
        })
        total += line_total

    # Create bill
    tax = round(total * 0.05, 2)  # 5% tax
    bill = Bill(
        patient_id=prescription.patient_id,
        prescription_id=prescription_id,
        bill_type="pharmacy",
        items=bill_items,
        subtotal=total,
        tax=tax,
        total_amount=round(total + tax, 2),
        payment_status="pending",
    )
    db.add(bill)

    # Update prescription status
    prescription.status = "dispensed"
    await db.flush()

    return {"bill": bill, "prescription": prescription}


async def mark_bill_paid(db: AsyncSession, bill_id: uuid.UUID, payment_method: str = "simulated") -> Bill:
    result = await db.execute(select(Bill).where(Bill.id == bill_id))
    bill = result.scalar_one_or_none()
    if not bill:
        raise ValueError("Bill not found")
    bill.payment_status = "paid"
    bill.payment_method = payment_method
    await db.flush()
    return bill


async def check_medicine_stock(db: AsyncSession, medicine_name: str) -> PharmacyItem | None:
    result = await db.execute(
        select(PharmacyItem).where(
            PharmacyItem.medicine_name.ilike(f"%{medicine_name}%")
        )
    )
    return result.scalar_one_or_none()
