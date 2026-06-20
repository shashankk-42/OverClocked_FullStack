# MediFlow AI — Pipeline & Architecture Details

---

## 1. Request Pipeline

Every request flows through these layers in order:

```
Client (Next.js)
    │
    ├── Clerk Session Token (attached automatically)
    │
    ▼
Nginx (Reverse Proxy)
    │
    ├── TLS Termination
    ├── Rate Limiting
    ├── Route: /api/* → Backend, /* → Frontend
    │
    ▼
FastAPI Application
    │
    ├── CORS Middleware
    ├── Request ID Middleware (X-Request-ID header)
    ├── Logging Middleware (request/response timing)
    │
    ▼
Auth Middleware
    │
    ├── Clerk JWT Verification
    ├── User Extraction (id, role, email)
    ├── Role Guard Check (route-specific)
    │
    ▼
Router → Service → DB / AI
    │
    ├── Pydantic Validation (request body)
    ├── Business Logic (service layer)
    ├── Database Operations (SQLAlchemy async)
    ├── AI Inference (Gemini API — when needed)
    ├── External API Calls (Razorpay, Supabase — when needed)
    │
    ▼
Response
    │
    ├── Pydantic Serialization (response model)
    ├── Error Handling (HTTPException → standard error shape)
    │
    ▼
Client
```

---

## 2. Authentication Pipeline

### Patient Registration Flow

```
Patient Opens App
       │
       ▼
  Clerk Sign-Up UI
       │
       ├── Phone Number Input
       ├── OTP Sent (via Clerk)
       ├── OTP Verified
       │
       ▼
  Clerk Creates User (role: patient)
       │
       ▼
  Clerk Webhook → FastAPI
       │
       ├── Verify webhook signature (svix)
       ├── Create patient record in PostgreSQL
       ├── Generate PID (MF-YYYYMMDD-XXXXXX)
       ├── Generate QR Code (contains PID)
       │
       ▼
  Patient Dashboard (PID + QR ready)
```

### Staff Login Flow

```
Staff Opens Portal
       │
       ▼
  Clerk Sign-In UI
       │
       ├── Email + Password
       ├── Role pre-assigned by admin in Clerk metadata
       │
       ▼
  JWT Token → FastAPI
       │
       ├── Verify token
       ├── Extract role from Clerk metadata
       ├── Route to role-specific dashboard
       │
       ▼
  Role Dashboard
```

---

## 3. AI Processing Pipeline

### Symptom Triage Pipeline

```
Patient enters symptoms (free text)
       │
       ▼
  FastAPI /api/v1/ai/triage
       │
       ├── Validate input (min length, sanitize)
       │
       ▼
  Gemini Flash
       │
       ├── System Prompt: Medical triage specialist
       ├── User Prompt: Patient symptoms
       ├── Output Format: JSON { department, priority, reasoning }
       │
       ▼
  Parse + Validate Response
       │
       ├── Map department to available departments in DB
       ├── Validate priority (low / medium / high / emergency)
       │
       ▼
  Return TriageResult
       │
       ├── Suggested department
       ├── Priority level
       ├── Available doctors in department
       ├── Next available slots
       │
       ▼
  Patient selects doctor + books appointment
```

### Consultation Documentation Pipeline

```
Doctor starts consultation
       │
       ▼
  Doctor speaks / types notes
       │
       ├── Voice → Browser Speech API → Text
       │   (or manual text entry)
       │
       ▼
  FastAPI /api/v1/consultations/{id}/notes
       │
       ├── Input: raw transcript + patient context
       │
       ▼
  Gemini 2.5 Pro
       │
       ├── System Prompt: Medical documentation specialist
       ├── Context: Patient history, current medications, allergies
       ├── Input: Doctor's raw notes/transcript
       ├── Output Format: Structured SOAP Note
       │
       ▼
  SOAP Note Generated
       │
       ├── Subjective: Patient complaints
       ├── Objective: Examination findings
       ├── Assessment: Diagnosis
       ├── Plan: Treatment plan
       │
       ▼
  Doctor reviews + edits + saves
```

### Prescription Generation Pipeline

```
Doctor enters diagnosis
       │
       ▼
  FastAPI /api/v1/consultations/{id}/prescription
       │
       ├── Input: diagnosis, patient history, allergies
       │
       ▼
  Gemini 2.5 Pro
       │
       ├── Generate prescription (medicines, dosages, duration)
       │
       ▼
  Drug Interaction Check (Gemini Flash)
       │
       ├── Cross-reference with current medications
       ├── Check known allergies
       ├── Flag conflicts
       │
       ▼
  If conflicts found → Alert doctor
  If clear → Present prescription for review
       │
       ▼
  Doctor approves / modifies
       │
       ▼
  Prescription saved → Pharmacy queue
```

---

## 4. Data Pipeline

### Patient Data Flow

```
Registration → appointments → consultations → prescriptions → billing
     │              │              │               │              │
     └──────────────┴──────────────┴───────────────┴──────────────┘
                                   │
                            All linked by PID
                                   │
                                   ▼
                          Patient Timeline
                    (chronological medical history)
```

### Report Processing Pipeline

```
Patient/Doctor uploads report
       │
       ▼
  FastAPI /api/v1/reports/upload
       │
       ├── Validate file type (PDF, image)
       ├── Validate file size (≤ 10 MB)
       │
       ▼
  Supabase Storage
       │
       ├── Upload to: reports/{pid}/{report_id}.{ext}
       ├── Generate signed URL
       │
       ▼
  Gemini 2.5 Pro (Report Analyzer)
       │
       ├── Extract text from PDF/image
       ├── Identify report type (blood, radiology, etc.)
       ├── Extract key findings
       ├── Flag abnormal values
       ├── Generate recommendations
       │
       ▼
  Save summary to reports table
       │
       ▼
  Available in Patient Timeline + Doctor Dashboard
```

---

## 5. Payment Pipeline

```
Pharmacy dispenses medicines
       │
       ▼
  Bill created (items + amounts)
       │
       ▼
  FastAPI /api/v1/billing/{bill_id}/pay
       │
       ├── Create Razorpay Order
       ├── Return order_id to frontend
       │
       ▼
  Frontend — Razorpay Checkout UI
       │
       ├── UPI / Card / Net Banking
       ├── Patient completes payment
       │
       ▼
  Razorpay Webhook → FastAPI
       │
       ├── Verify payment signature
       ├── Update bill status → 'paid'
       ├── Update prescription status → 'dispensed'
       │
       ▼
  Receipt generated for patient
```

---

## 6. Queue Management Pipeline

```
Patient checks in (QR scan at reception)
       │
       ▼
  Reception confirms check-in
       │
       ├── Verify appointment exists + status = 'booked'
       ├── Update status → 'checked_in'
       │
       ▼
  Queue Assignment
       │
       ├── Get doctor's current queue
       ├── Assign position based on:
       │   1. Appointment time
       │   2. Priority (emergency > high > medium > low)
       │   3. Check-in time (tiebreaker)
       │
       ▼
  Queue Board Updated
       │
       ├── Reception sees full queue
       ├── Patient sees their position
       ├── Doctor sees next patient
       │
       ▼
  Doctor calls next → status = 'in_consultation'
       │
       ▼
  Consultation complete → status = 'completed'
       │
       ▼
  Patient directed to pharmacy (if prescription exists)
```

---

## 7. Error Handling Architecture

```
Exception Raised
       │
       ├── Known Business Error (e.g., slot taken)
       │   └── HTTPException(409, detail="Slot already booked", code="SLOT_CONFLICT")
       │
       ├── Validation Error (Pydantic)
       │   └── 422 Unprocessable Entity (automatic)
       │
       ├── Auth Error
       │   └── 401 Unauthorized / 403 Forbidden
       │
       ├── AI Error (Gemini timeout/failure)
       │   └── Retry with exponential backoff (max 3 attempts)
       │   └── Fallback: return partial result or ask doctor to proceed manually
       │
       ├── External Service Error (Razorpay, Supabase)
       │   └── 502 Bad Gateway with descriptive message
       │   └── Log full error details for debugging
       │
       └── Unhandled Error
           └── 500 Internal Server Error
           └── Log full traceback
           └── Don't expose stack trace to client
```

---

## 8. Caching Strategy (Phase 2+)

| Data | Cache | TTL | Invalidation |
| ---- | ----- | --- | ------------ |
| Doctor list + schedules | Redis | 15 min | On schedule update |
| Department list | Redis | 1 hour | On admin change |
| Patient summary (AI) | Redis | 10 min | On new visit/report |
| Pharmacy inventory | Redis | 5 min | On dispense event |
| Queue positions | Redis Pub/Sub | Real-time | On any queue change |
