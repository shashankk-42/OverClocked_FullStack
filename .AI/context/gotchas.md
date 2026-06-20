# MediFlow AI — Gotchas & Guardrails

> Things that will bite you if ignored. Read before making changes.

---

## 🔴 Critical — Will Break Production

### 1. Gemini API — No-Storage Mode is Mandatory

When calling Gemini with patient data, always use the `safety_settings` and ensure the API is configured to **not store** request/response data. Patient medical records must never be retained by the Gemini API.

```python
# ✅ Correct
generation_config = GenerationConfig(
    # ... your config
)
# Set up the client with appropriate data handling

# ❌ Wrong — default config may store data
model.generate_content(patient_data)
```

### 2. PID Must Be Globally Unique

The Patient ID (PID) is the **universal join key** across the entire system. Collision = catastrophic data merge.

- Use a format like `MF-{YYYYMMDD}-{6-char-alphanumeric}` (e.g., `MF-20260620-A7X3K9`)
- Always check for uniqueness before committing
- Never allow PID reassignment or recycling

### 3. Prescription medicines Column is JSONB — Not a Relation

`prescriptions.medicines` stores an array of medicine objects as JSONB, not as a foreign key to the pharmacy table. This is intentional for historical integrity (medicine names/dosages must be frozen at prescription time).

```json
[
  {"name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "duration": "30 days"},
  {"name": "Amlodipine", "dosage": "5mg", "frequency": "once daily", "duration": "30 days"}
]
```

**Gotcha:** Don't try to join prescriptions → pharmacy by medicine name. Compare by normalized name for inventory checks only.

### 4. Clerk Webhook Signature Verification

Always verify the `svix-signature` header on Clerk webhooks. Skipping this opens the system to spoofed user creation events.

```python
# ✅ Always verify
from svix.webhooks import Webhook
wh = Webhook(CLERK_WEBHOOK_SECRET)
payload = wh.verify(body, headers)
```

---

## 🟡 Warning — Will Cause Subtle Bugs

### 5. Timezone Handling — Always Use UTC Internally

All database timestamps must be stored in **UTC**. Convert to local timezone only at the frontend display layer.

```python
# ✅ Backend — always UTC
from datetime import datetime, timezone
created_at = datetime.now(timezone.utc)

# ✅ Frontend — convert for display
new Date(utcTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
```

**Why:** Appointment scheduling across timezones will silently produce wrong slots if you store local time.

### 6. Appointment Conflict Detection Must Be Atomic

When booking an appointment, the check-for-conflict + insert must happen in a **single transaction** with row-level locking. Otherwise, two concurrent bookings can claim the same slot.

```python
# ✅ Use SELECT ... FOR UPDATE
async with session.begin():
    existing = await session.execute(
        select(Appointment)
        .where(Appointment.doctor_id == doctor_id)
        .where(Appointment.slot == requested_slot)
        .with_for_update()
    )
    if existing.scalar():
        raise ConflictError("Slot already booked")
    session.add(new_appointment)
```

### 7. Drug Interaction Checker — Must Run BEFORE Prescription Save

The AI drug interaction check must execute **before** the prescription is committed, not after. If you check post-save, the patient may already be dispensed conflicting medicines.

### 8. Razorpay Payment Verification — Always Server-Side

Never trust the client-side payment success callback alone. Always verify the payment signature server-side via the Razorpay webhook or verification API.

```python
# ✅ Server-side verification
razorpay_client.utility.verify_payment_signature({
    'razorpay_order_id': order_id,
    'razorpay_payment_id': payment_id,
    'razorpay_signature': signature
})
```

---

## 🟢 Tips — Will Save You Time

### 9. ShadCN Components — Don't Install All at Once

ShadCN components are added individually via CLI. Only add what you need:

```bash
npx shadcn-ui@latest add button card dialog table
```

**Why:** Each component pulls in its Radix primitive. Installing all creates unnecessary bundle bloat.

### 10. FastAPI Dependency Injection for Auth

Use FastAPI's `Depends()` for auth guards, not decorators. This keeps the auth logic testable and composable:

```python
# ✅ Dependency injection
@router.get("/patients/{pid}")
async def get_patient(
    pid: str,
    current_user: User = Depends(require_role("doctor", "admin"))
):
    ...
```

### 11. Next.js App Router — Server vs Client Components

- **Server Components** (default): For data fetching, SEO, and rendering static content.
- **Client Components** (`"use client"`): For interactivity — forms, modals, real-time updates.
- **Gotcha:** Don't put `"use client"` on layout files unless every child needs interactivity.

### 12. SQLAlchemy 2.x Async — Session Lifecycle

Always use `async with` for session management. Forgetting to close sessions will exhaust the connection pool.

```python
# ✅ Correct
async with async_session() as session:
    result = await session.execute(query)

# ❌ Wrong — session leak
session = async_session()
result = await session.execute(query)
# forgot to close!
```

### 13. Supabase File Paths — Use PID Prefix

Organize uploads by patient PID for easy retrieval and cleanup:

```
reports/{pid}/{report_id}.pdf
```

**Never** store files in a flat namespace — you'll lose track fast.

### 14. Queue Management — Optimistic UI

The reception queue board should use **optimistic updates** on the frontend (update UI immediately, rollback on error) to feel responsive. Don't wait for the server round-trip to show queue position changes.

---

## 🔵 Convention — Team Agreements

### 15. API Route Naming

All API routes follow RESTful conventions with plural nouns:

```
GET    /api/v1/patients/{pid}
POST   /api/v1/appointments
PATCH  /api/v1/prescriptions/{id}
DELETE /api/v1/reports/{id}
```

### 16. Error Response Format

All API errors return a consistent shape:

```json
{
  "detail": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "field": "optional_field_name"
}
```

### 17. Commit Message Convention

```
feat(patient): add PID generation with QR code
fix(pharmacy): correct stock decrement on dispense
docs(ai): add triage prompt engineering notes
```

### 18. Branch Naming

```
feat/patient-registration
fix/appointment-conflict
refactor/ai-module-extraction
```
