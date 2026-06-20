# MediFlow AI — System Architecture

> **One Patient ID. One AI Brain. One Seamless Healthcare Journey.**

---

## 1. High-Level Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER (Next.js)                        │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Patient  │  │  Reception   │  │   Doctor   │  │   Pharmacy   │  │
│  │   App    │  │  Dashboard   │  │  Dashboard │  │  Dashboard   │  │
│  └────┬─────┘  └──────┬───────┘  └─────┬──────┘  └──────┬───────┘  │
│       │               │               │                │            │
│       └───────────────┴───────┬───────┴────────────────┘            │
│                               │                                     │
│                       Shared UI Layer                               │
│                   (ShadCN + Tailwind CSS)                           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS / REST + WebSocket
                                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                        API TIER (FastAPI)                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    Auth Middleware (Clerk)                       │  │
│  │              Role Guard · OTP Verification · JWT                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐     │
│  │ Patient  │ │Appointmt │ │ Consultation │ │    Pharmacy      │     │
│  │ Service  │ │ Service  │ │   Service    │ │    Service       │     │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────────┘     │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐     │
│  │  Queue   │ │ Billing  │ │   Report     │ │   Navigation     │     │
│  │ Service  │ │ Service  │ │   Service    │ │    Service       │     │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────────┘     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │              Gemini AI Intelligence Layer                       │  │
│  │  Triage · Summary · Report Analysis · SOAP Notes · Rx Explain  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
              ┌─────────────────┼──────────────────┐
              ▼                 ▼                  ▼
     ┌──────────────┐  ┌──────────────┐   ┌──────────────┐
     │  PostgreSQL  │  │   Supabase   │   │   Razorpay   │
     │  (Primary DB)│  │   Storage    │   │  (Payments)  │
     └──────────────┘  └──────────────┘   └──────────────┘
```

---

## 2. Layer Breakdown

### 2.1 Client Tier — Next.js (React + Tailwind + ShadCN)

| Portal             | Primary User   | Core Screens                                              |
| ------------------- | -------------- | --------------------------------------------------------- |
| **Patient App**     | Patient        | Login, PID Card, Appointment Booking, AI Chat, History    |
| **Reception Dash**  | Receptionist   | QR Check-In, Queue Board, Appointment Verification        |
| **Doctor Dash**     | Doctor         | PID Search, Patient Timeline, AI Notes, Rx Generator      |
| **Pharmacy Dash**   | Pharmacist     | Prescription Viewer, Alt-Medicine Engine, Billing          |
| **Admin Dash**      | Administrator  | Analytics, Patient Flow, Operational Reports (Phase 2+)   |

All portals share a **Design System** built on ShadCN UI components with Tailwind utility classes. Routing is handled by Next.js App Router with role-based layout groups:

```
/app
  /(patient)/...
  /(reception)/...
  /(doctor)/...
  /(pharmacy)/...
  /(admin)/...
```

### 2.2 API Tier — FastAPI (Python)

The backend is a single FastAPI application organised as a **modular monolith** with clear service boundaries.

```
src/backend/
├── app/
│   ├── main.py                 # FastAPI app factory
│   ├── config.py               # Environment + settings (Pydantic BaseSettings)
│   ├── auth/
│   │   ├── clerk.py            # Clerk webhook + JWT verification
│   │   ├── guards.py           # Role-based dependency injectors
│   │   └── otp.py              # Phone OTP flow
│   ├── services/
│   │   ├── patient.py          # Registration, PID generation, QR
│   │   ├── appointment.py      # Booking, scheduling, conflict detection
│   │   ├── consultation.py     # Doctor visit, notes, prescription gen
│   │   ├── queue.py            # Real-time queue management
│   │   ├── pharmacy.py         # Stock, dispensing, alternatives
│   │   ├── billing.py          # Invoice, Razorpay integration
│   │   ├── report.py           # Upload, AI analysis, storage
│   │   └── navigation.py       # Hospital wayfinding
│   ├── ai/
│   │   ├── gemini_client.py    # Shared Gemini API wrapper
│   │   ├── triage.py           # Symptom → Department + Priority
│   │   ├── patient_summary.py  # History → Clinical summary
│   │   ├── report_analyzer.py  # PDF/Lab → Key findings
│   │   ├── soap_notes.py       # Voice → Structured SOAP notes
│   │   └── rx_explainer.py     # Medical Rx → Patient-friendly text
│   ├── models/                 # SQLAlchemy ORM models
│   ├── schemas/                # Pydantic request/response schemas
│   ├── routers/                # FastAPI router modules
│   └── db/
│       ├── session.py          # Async session factory
│       └── migrations/         # Alembic migrations
├── tests/
└── requirements.txt
```

### 2.3 Data Tier — PostgreSQL

Seven core tables keyed by UUIDs; the **Patient ID (PID)** is the universal join key.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   patients   │────<│ appointments │>────│     doctors       │
│  (pid, uuid) │     │              │     │                   │
└──────┬───────┘     └──────────────┘     └───────────────────┘
       │
       ├────<┌──────────────┐
       │     │   reports    │
       │     └──────────────┘
       │
       ├────<┌──────────────┐     ┌──────────────┐
       │     │prescriptions │>────│   doctors    │
       │     │  (medicines) │     └──────────────┘
       │     └──────────────┘
       │
       ├────<┌──────────────┐
       │     │    bills     │
       │     └──────────────┘
       │
       └─────┌──────────────┐
             │   pharmacy   │  (standalone inventory)
             └──────────────┘
```

### 2.4 AI Intelligence Layer — Gemini

| Module | Model | Input | Output | Latency Target |
| ------ | ----- | ----- | ------ | -------------- |
| Symptom Triage | Gemini Flash | Free-text symptoms | Department + Priority | < 2 s |
| Patient Summary | Gemini 2.5 Pro | Full patient history | Clinical summary | < 5 s |
| Report Analyzer | Gemini 2.5 Pro | PDF / Lab report | Key findings + recommendations | < 8 s |
| SOAP Notes | Gemini 2.5 Pro | Voice transcript | Structured SOAP note | < 5 s |
| Rx Explainer | Gemini Flash | Prescription JSON | Patient-friendly explanation | < 2 s |
| Drug Interaction | Gemini Flash | Medicine list + allergies | Conflict warnings | < 2 s |
| Alt-Medicine | Gemini Flash | Unavailable medicine + context | Alternative suggestions | < 2 s |

### 2.5 External Integrations

| Service | Purpose | Integration Point |
| ------- | ------- | ----------------- |
| **Clerk** | Authentication, user management, role assignment | Auth middleware |
| **Supabase Storage** | Medical report uploads (PDF, images) | Report service |
| **Razorpay** | Payment processing for pharmacy billing | Billing service |
| **Google Gemini API** | All AI inference calls | AI module layer |

---

## 3. Data Flow — Patient Journey

```
Patient Signs Up
       │
       ▼
  PID Generated ──────────────────────────────────────────┐
       │                                                   │
       ▼                                                   │
  Symptoms → AI Triage → Department + Doctor Suggestion    │
       │                                                   │
       ▼                                                   │
  Appointment Booked                                       │
       │                                                   │
       ▼                                                   │
  QR Check-In → Reception Queue Assignment                 │
       │                                                   │
       ▼                                                   │
  Doctor Opens PID ──→ AI Patient Summary                  │
       │              ──→ Patient Timeline                 │
       ▼                                                   │
  Consultation ──→ AI SOAP Notes                           │
       │          ──→ AI Prescription Generator             │
       │          ──→ Drug Interaction Checker              │
       ▼                                                   │
  Prescription → Pharmacy Dashboard                        │
       │          ──→ Alt-Medicine Engine                   │
       │          ──→ Inventory Update                     │
       ▼                                                   │
  Bill Created → Razorpay Payment                          │
       │                                                   │
       ▼                                                   │
  Follow-Up Care                                           │
       ├── Medicine Reminders                              │
       ├── Follow-Up Scheduling                            │
       └── AI Rx Explanation ──────────────────────────────┘
              (all linked back to PID)
```

---

## 4. Authentication & Authorization

```
┌──────────────┐         ┌─────────────┐         ┌────────────────┐
│  Client App  │──token──│   Clerk     │──JWT────│   FastAPI      │
│  (Next.js)   │         │  (Auth)     │         │  Auth Guard    │
└──────────────┘         └─────────────┘         └───────┬────────┘
                                                          │
                                                   Role Extraction
                                                          │
                                         ┌────────────────┼────────────────┐
                                         ▼                ▼                ▼
                                    PATIENT          STAFF             ADMIN
                                   (self-data)    (assigned data)   (all data)
```

**Roles:** `patient` · `receptionist` · `doctor` · `nurse` · `pharmacist` · `admin`

- Patients authenticate via **Phone OTP**.
- Staff authenticate via **Email/Password** with role pre-assigned by admin.
- Every API endpoint is gated by a **role guard** dependency.

---

## 5. Deployment Architecture (MVP)

```
┌────────────────────────────────────────────┐
│              Docker Compose                 │
│                                             │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │  Next.js     │    │    FastAPI       │  │
│  │  (Port 3000) │    │   (Port 8000)   │  │
│  └──────┬───────┘    └────────┬─────────┘  │
│         │                     │             │
│         └──────────┬──────────┘             │
│                    │                        │
│           ┌────────▼─────────┐              │
│           │    PostgreSQL    │              │
│           │   (Port 5432)   │              │
│           └─────────────────┘              │
│                                             │
│           ┌─────────────────┐              │
│           │     Nginx       │              │
│           │  (Reverse Proxy)│              │
│           │   (Port 80/443) │              │
│           └─────────────────┘              │
└────────────────────────────────────────────┘
         │
    External APIs
    ├── Clerk (Auth)
    ├── Google Gemini (AI)
    ├── Supabase (Storage)
    └── Razorpay (Payments)
```

---

## 6. Key Architecture Decisions

| Decision | Rationale |
| -------- | --------- |
| **Modular monolith** over microservices | Hackathon speed; clear service boundaries allow future extraction |
| **FastAPI** for backend | Async-native, auto-generated OpenAPI docs, Pydantic validation |
| **Next.js App Router** | Server components for SEO, role-based layout groups, streaming |
| **PostgreSQL** (single DB) | ACID guarantees for medical data; JSON columns for flexible Rx storage |
| **Gemini Flash for low-latency** | Triage / explanations need < 2 s; Pro reserved for complex analysis |
| **Clerk** over custom auth | Battle-tested, OTP built-in, role management, webhook-driven sync |
| **Supabase Storage** over S3 | Simpler SDK, RLS policies, generous free tier for MVP |
| **Razorpay** | Indian market focus; UPI + card support; well-documented API |

---

## 7. Security Considerations

- All medical data encrypted at rest (PostgreSQL TDE) and in transit (TLS 1.3).
- RBAC enforced at both frontend (route guards) and backend (dependency injection guards).
- Patient data access logged for audit trails.
- Gemini API calls use **no-storage mode** — patient data is not retained by Google.
- File uploads validated for type/size before Supabase Storage ingestion.
- CORS restricted to known frontend origins.
- Rate limiting on public endpoints (login, OTP).

---

## 8. Scalability Path (Post-MVP)

| Phase | Change |
| ----- | ------ |
| Phase 2 | Add Redis for queue pub/sub + caching; Nurse dashboard; Bed management |
| Phase 3 | Extract AI layer into a dedicated service; WebSocket for real-time queue updates |
| Phase 4 | Split into microservices; add API gateway; event-driven architecture |
