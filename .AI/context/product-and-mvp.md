# MediFlow AI — Product & MVP Scope

---

## 1. Product Overview

**MediFlow AI** is an AI-powered Hospital Operating System that unifies the complete patient journey through a single **Patient ID (PID)**. It connects Patients, Reception Staff, Doctors, Nurses, Pharmacists, and Hospital Administrators through a centralized AI intelligence layer powered by Google Gemini.

### Value Proposition

> One Patient ID. One AI Brain. One Seamless Healthcare Journey.

---

## 2. MVP Scope (Hackathon)

### 2.1 Patient App

| Feature | Priority | Description |
| ------- | -------- | ----------- |
| Phone OTP Login | P0 | Clerk-based phone authentication |
| PID Generation | P0 | Unique Patient ID with QR code |
| Appointment Booking | P0 | AI triage → department → doctor → slot selection |
| AI Chat Assistant | P0 | Symptom intake, Rx explanation, hospital navigation |
| Medical History | P0 | Timeline view of visits, reports, prescriptions |
| Medicine Reminders | P1 | Scheduled reminders based on active prescriptions |
| Report Viewer | P1 | View uploaded reports with AI-generated summaries |
| Profile Management | P1 | Emergency contacts, allergies, basic health info |

### 2.2 Doctor Dashboard

| Feature | Priority | Description |
| ------- | -------- | ----------- |
| PID Search | P0 | Look up any patient by PID or name |
| Patient Summary | P0 | AI-generated clinical summary from full history |
| Patient Timeline | P0 | Chronological view: visits, reports, diagnoses, Rx |
| AI SOAP Notes | P0 | Voice/text → structured SOAP documentation |
| Prescription Generator | P0 | AI-assisted Rx with drug interaction checking |
| Today's Schedule | P1 | View of day's appointments + queue |
| Report Analysis | P1 | AI analysis of uploaded patient reports |

### 2.3 Reception Dashboard

| Feature | Priority | Description |
| ------- | -------- | ----------- |
| QR Check-In | P0 | Scan patient QR to check in |
| Queue Management | P0 | Real-time queue board per doctor |
| Appointment Verification | P0 | Verify today's appointments |
| Manual PID Lookup | P1 | Search patient by PID / name / phone |

### 2.4 Pharmacy Dashboard

| Feature | Priority | Description |
| ------- | -------- | ----------- |
| Prescription Viewer | P0 | View pending prescriptions from doctors |
| Medicine Dispensing | P0 | Mark medicines as dispensed, update stock |
| Alternative Medicine | P0 | AI suggestions when medicine is out of stock |
| Billing & Payment | P0 | Generate bill, Razorpay payment integration |
| Inventory Overview | P1 | Stock levels, low-stock alerts |

---

## 3. Feature Prioritization

### P0 — Must Have (Hackathon Demo)

These features form the **core patient journey** from registration to billing:

```
Registration → Triage → Booking → Check-In → Consultation → Prescription → Dispensing → Payment
```

Every P0 feature directly supports one step in this journey.

### P1 — Should Have (Polish for Demo)

Features that enhance the demo but aren't on the critical path:
- Medicine reminders, profile management
- Report analysis, schedule view
- Manual PID lookup
- Inventory overview

### P2 — Future (Post-Hackathon)

- Nurse dashboard
- Admin analytics dashboard
- Bed management
- Insurance integration
- Lab integration
- Wearable device integration

---

## 4. User Flows (MVP)

### Flow 1: New Patient Registration

```
1. Patient opens app
2. Clicks "Sign Up"
3. Enters phone number
4. Receives OTP → enters OTP
5. Fills basic profile (name, DOB, gender, blood group)
6. PID generated (MF-YYYYMMDD-XXXXXX)
7. QR code generated
8. Lands on Patient Dashboard
```

**Success Criteria:** PID is generated, QR is scannable, patient record exists in DB.

### Flow 2: Appointment Booking (AI Triage)

```
1. Patient clicks "Book Appointment"
2. Describes symptoms in free text
3. AI Triage → suggests department + priority
4. Patient sees available doctors in department
5. Selects doctor → sees available slots
6. Books slot → receives confirmation
7. Appointment appears in dashboard + doctor's schedule
```

**Success Criteria:** Triage returns valid department, appointment created, no slot conflicts.

### Flow 3: Hospital Check-In

```
1. Patient arrives at hospital
2. Receptionist scans QR code (or searches PID)
3. System shows today's appointment
4. Receptionist clicks "Check In"
5. Patient assigned queue position
6. Queue board updates in real time
```

**Success Criteria:** Check-in updates appointment status, queue position assigned.

### Flow 4: Doctor Consultation

```
1. Doctor sees next patient in queue
2. Opens patient view (via PID)
3. Reviews AI Patient Summary + Timeline
4. Conducts consultation
5. Speaks/types notes → AI generates SOAP note
6. Enters diagnosis → AI generates prescription
7. Drug interaction check runs automatically
8. Doctor reviews + approves prescription
9. Prescription sent to pharmacy
10. Consultation marked complete
```

**Success Criteria:** SOAP note saved, prescription saved, pharmacy notified.

### Flow 5: Pharmacy Dispensing + Payment

```
1. Pharmacist sees pending prescription
2. Opens prescription details
3. Checks stock for each medicine
4. If out of stock → AI suggests alternative
5. Dispenses medicines
6. Bill generated automatically
7. Patient pays via Razorpay (UPI/card)
8. Payment verified server-side
9. Receipt generated
```

**Success Criteria:** Medicines dispensed, stock updated, payment verified, receipt generated.

---

## 5. Success Metrics (MVP)

| Metric | Target |
| ------ | ------ |
| Patient registration → PID in | < 30 seconds |
| AI Triage response | < 2 seconds |
| Appointment booking (end-to-end) | < 2 minutes |
| QR check-in | < 5 seconds |
| AI SOAP note generation | < 5 seconds |
| AI prescription generation | < 5 seconds |
| Pharmacy dispense → payment | < 3 minutes |
| Full patient journey demo | < 10 minutes |

---

## 6. Out of Scope (MVP)

- Multi-hospital / multi-tenant support
- Nurse dashboard and bed management
- Admin analytics beyond basic counts
- Insurance / third-party payer integration
- Laboratory system integration
- Wearable device data ingestion
- Indoor GPS / AR navigation
- Telemedicine / video consultations
- Multi-language support
- Offline mode / PWA

---

## 7. Risks & Mitigations

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Gemini API latency spikes | Slow consultations | Flash for speed-critical calls; graceful fallback |
| Clerk OTP delivery delays | Blocked registration | Manual PID entry fallback at reception |
| Razorpay sandbox limitations | Payment demo failure | Pre-record payment flow video as backup |
| Medical accuracy of AI | Trust / safety | Always require doctor review before saving; disclaimers |
| Database migration conflicts | Dev velocity | Alembic auto-merge; squash migrations before demo |
| Complex scope for hackathon | Incomplete demo | P0/P1 split; demo the golden path only |
