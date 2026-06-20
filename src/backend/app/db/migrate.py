"""Lightweight schema patches for columns added after initial deploy."""

SCHEMA_PATCHES = [
    "ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(500)",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS appointment_id UUID",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255)",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_type VARCHAR(50) DEFAULT 'consultation'",
    "ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_link_sent_at TIMESTAMPTZ",
]


async def apply_schema_patches(conn) -> None:
    for sql in SCHEMA_PATCHES:
        await conn.exec_driver_sql(sql)
