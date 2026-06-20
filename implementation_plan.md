# MediFlow AI — Implementation Plan

## Overview

Build the complete MediFlow AI full-stack application: FastAPI backend + Next.js frontend, covering all four MVP dashboards (Patient, Doctor, Reception, Pharmacy) with live Gemini AI integration.

---

## Scope & Simplifications for MVP

> [!IMPORTANT]
> **Auth:** No Clerk key was provided. I will implement a **simple JWT-based auth with demo users** (pre-seeded in DB). Patients login with phone+OTP demo flow, staff with email+password. This is production-replaceable with Clerk later.
>
> **Storage:** Supabase Storage → replaced with **local file storage** (saved to `uploads/` dir). Swappable post-MVP.
>
> **Payments:** Razorpay → replaced with **simulated payment** (one click = paid). Swappable post-MVP.
>
> **Gemini API Key:** ✅ Provided — all AI features fully live.

---

## Open Questions

> [!WARNING]
> **Decision needed:** Should the frontend and backend be in a monorepo (`src/frontend` + `src/backend`) or separate? Based on the architecture doc I'll use the monorepo approach.
>
> **Database:** Will use a local PostgreSQL instance via Docker. Do you have Docker installed? If not, I'll use SQLite for the MVP (still with SQLAlchemy, fully replaceable).

I'll proceed with **Docker + PostgreSQL** as the architecture specifies, with a SQLite fallback note.

---

## Proposed Changes

### Phase 1 — Backend Foundation

#### [NEW] `src/backend/` — FastAPI Application

**`app/main.py`** — App factory with CORS, middleware, router registration

**`app/config.py`** — Pydantic BaseSettings reading from `.env`

**`app/db/`** — SQLAlchemy async engine, session factory, Base model

**`app/models/`** — ORM models:
- `patient.py` — Patient (id, pid, name, phone, dob, gender, blood_group, allergies, emergency_contact)
- `doctor.py` — Doctor (id, name, specialization, department, email)
- `appointment.py` — Appointment (id, patient_id, doctor_id, date, status, queue_position)
- `prescription.py` — Prescription (id, patient_id, doctor_id, appointment_id, medicines JSONB, soap_notes, diagnosis, status)
- `report.py` — Report (id, patient_id, report_type, file_path, summary, created_at)
- `pharmacy.py` — PharmacyItem (id, medicine_name, generic_name, stock, price, unit)
- `bill.py` — Bill (id, patient_id, prescription_id, items JSONB, amount, payment_status)
- `user.py` — User (id, email, password_hash, role, linked_id — doctor/patient id)

**`app/auth/`** — JWT auth:
- `jwt.py` — Token creation + verification
- `guards.py` — `require_role()` FastAPI dependencies
- `hashing.py` — bcrypt password hashing

**`app/services/`** — Business logic:
- `patient.py` — PID generation, QR code, registration
- `appointment.py` — Booking with conflict detection, slot management
- `consultation.py` — SOAP note save, prescription create
- `queue.py` — Queue position assignment, updates
- `pharmacy.py` — Dispensing, stock management, alternatives
- `billing.py` — Bill creation, payment simulation

**`app/ai/`** — Gemini modules:
- `gemini_client.py` — Shared async Gemini client
- `triage.py` — Symptoms → Department + Priority
- `patient_summary.py` — History → Clinical summary
- `soap_notes.py` — Transcript → SOAP note
- `prescription_gen.py` — Diagnosis → Rx suggestions
- `drug_interaction.py` — Medicines → Conflict check
- `alt_medicine.py` — Unavailable med → Alternatives
- `rx_explainer.py` — Rx → Patient-friendly text

**`app/routers/`** — FastAPI routers:
- `auth.py` — Login, register, token refresh
- `patients.py` — Patient CRUD, PID lookup
- `appointments.py` — Booking, check-in, status
- `consultations.py` — Start, notes, prescriptions
- `queue.py` — Queue board, position updates
- `pharmacy.py` — Prescriptions queue, dispense, inventory
- `billing.py` — Bill create, payment
- `ai.py` — Direct AI endpoints (triage, chat)
- `reports.py` — Upload, list, AI analysis

**`app/schemas/`** — Pydantic schemas for every router

**`alembic/`** — Database migrations

**`requirements.txt`** — All dependencies

**`seed.py`** — Demo data seeder (doctors, pharmacy inventory, demo users)

**`Dockerfile`** — Backend container

---

### Phase 2 — Frontend Foundation

#### [NEW] `src/frontend/` — Next.js 14 Application

**Setup:**
```
npx create-next-app@latest src/frontend --typescript --tailwind --app --no-src-dir
```

**`components.json`** — ShadCN config

**Core dependencies added:**
- `@tanstack/react-query` — server state
- `react-hook-form` + `zod` — forms
- `axios` — HTTP client
- `qrcode.react` — QR code display
- `recharts` — charts for admin
- `date-fns` — date formatting
- `framer-motion` — animations
- `lucide-react` — icons (via ShadCN)

**ShadCN components installed:**
button, card, dialog, table, badge, input, select, textarea, tabs, avatar, dropdown-menu, toast, sheet, progress, skeleton, alert, separator, scroll-area, form

**`app/layout.tsx`** — Root layout (Inter font, QueryProvider, ThemeProvider, Toaster)

**`app/globals.css`** — Custom CSS variables (dark blue medical theme)

**`lib/api.ts`** — Axios client with JWT interceptors

**`lib/auth.ts`** — Token storage, getCurrentUser, logout

**`contexts/AuthContext.tsx`** — Auth state provider

---

### Phase 3 — Auth & Landing Pages

**`app/page.tsx`** — Landing page with role-based redirect + login options

**`app/login/page.tsx`** — Unified login (patient phone / staff email)

**`app/register/page.tsx`** — Patient registration

---

### Phase 4 — Patient Dashboard

**`app/(patient)/layout.tsx`** — Sidebar nav, header
**`app/(patient)/dashboard/page.tsx`** — PID card + QR, appointments, reminders
**`app/(patient)/book/page.tsx`** — AI triage wizard → booking
**`app/(patient)/history/page.tsx`** — Medical timeline
**`app/(patient)/chat/page.tsx`** — AI assistant chat

---

### Phase 5 — Doctor Dashboard

**`app/(doctor)/layout.tsx`** — Doctor sidebar
**`app/(doctor)/dashboard/page.tsx`** — Today's queue + schedule
**`app/(doctor)/consultation/[id]/page.tsx`** — Full consultation view: patient summary, SOAP notes, Rx generator
**`app/(doctor)/patient/[pid]/page.tsx`** — Full patient history view

---

### Phase 6 — Reception Dashboard

**`app/(reception)/layout.tsx`** — Reception sidebar
**`app/(reception)/dashboard/page.tsx`** — Queue board (all doctors)
**`app/(reception)/check-in/page.tsx`** — PID/QR lookup + check-in

---

### Phase 7 — Pharmacy Dashboard

**`app/(pharmacy)/layout.tsx`** — Pharmacy sidebar
**`app/(pharmacy)/dashboard/page.tsx`** — Pending prescriptions
**`app/(pharmacy)/prescription/[id]/page.tsx`** — Dispense + alt medicine
**`app/(pharmacy)/inventory/page.tsx`** — Stock table + alerts

---

### Phase 8 — Docker & Environment

**`docker-compose.yml`** — PostgreSQL + Backend + Frontend + Nginx
**`.env.example`** — Template with all vars
**`README.md`** — Setup instructions

---

## Verification Plan

### Automated
- `pytest src/backend/tests/` — backend service + API tests
- `npm run build` — Next.js build check (no TS errors)

### Manual (Demo Flow)
1. Register patient → verify PID + QR generated
2. AI Triage: enter "fever and headache" → verify department suggestion
3. Book appointment → verify slot saved, no conflict
4. Reception check-in via PID → verify queue position
5. Doctor opens patient → verify AI summary generated
6. Doctor generates SOAP notes → verify structured output
7. Doctor creates prescription → verify drug interaction check runs
8. Pharmacy dispenses → verify stock decremented + bill created
9. Mark payment done → verify bill status = paid

---

## Build Order

1. ✅ Backend models + DB setup
2. ✅ Auth service (JWT)
3. ✅ All services + routers
4. ✅ Gemini AI modules (live)
5. ✅ Seed data
6. ✅ Next.js scaffold + design system
7. ✅ Auth pages
8. ✅ Patient dashboard
9. ✅ Doctor dashboard
10. ✅ Reception dashboard
11. ✅ Pharmacy dashboard
12. ✅ Docker + env setup
