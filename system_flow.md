# MediFlow System Navigation & Architecture

This document breaks down the navigation flow across the various user roles within the MediFlow application into distinct, focused charts. It also outlines the core technologies powering these flows.

---

## 1. Authentication & Entry Flow

This flow covers how users enter the application and are routed to their respective dashboards based on their role.

```mermaid
flowchart TD
    Home["Home Page (/)"]
    Login["Login (/login)"]
    Register["Register (/register)"]

    Home --> Login
    Home --> Register

    Login --> AuthCheck{Role Check}
    AuthCheck -->|Patient| PatientDB["Patient Dashboard"]
    AuthCheck -->|Doctor| DoctorDB["Doctor Dashboard"]
    AuthCheck -->|Receptionist| ReceptionDB["Reception Dashboard"]
    AuthCheck -->|Pharmacist| PharmacyDB["Pharmacy Dashboard"]
```

**Tech Stack Used:**
*   **Authentication & Session Management:** Clerk
*   **Routing:** Next.js 14+ (App Router)
*   **API Client:** Axios with JWT Interceptors
*   **Backend:** FastAPI `auth.py` router with `python-jose`

---

## 2. Patient Flow

The patient portal is designed for self-service, allowing patients to manage their health journey independently.

```mermaid
flowchart TD
    PatientDB["Patient Dashboard"]
    
    PatientDB --> P_Clinical["Clinical Features"]
    P_Clinical --> P_History["Medical History"]
    P_Clinical --> P_Meds["Medications"]
    P_Clinical --> P_Reports["Lab Reports"]
    P_Clinical --> P_Journey["Patient Journey"]

    PatientDB --> P_Services["Hospital Services"]
    P_Services --> P_Book["Book Appointment"]
    P_Services --> P_Chat["AI Chat Assistant"]
    P_Services --> P_Triage["Visual Triage"]
    P_Services --> P_Map["Hospital Map"]
    P_Services --> P_Rooms["Room Availability"]
    P_Services --> P_Emergency["Emergency Alert"]

    PatientDB --> P_Admin["Administration"]
    P_Admin --> P_Billing["Billing & Payments"]
    P_Admin --> P_Insurance["Insurance Policies"]
    P_Admin --> P_Family["Family Group"]
    P_Admin --> P_Profile["Profile Settings"]
```

**Tech Stack Used:**
*   **Frontend UI:** React 18+, Tailwind CSS, ShadCN UI, Lucide React icons
*   **State & Data Fetching:** TanStack Query (v5) for caching and optimistic updates
*   **Map Integration:** Custom React component with dynamic floor plans
*   **AI Integration:** Gemini API (via FastAPI backend) for Chat Assistant and Visual Triage
*   **Forms & Validation:** React Hook Form + Zod

---

## 3. Doctor Flow

The clinical interface is focused on patient care, consultations, and quick access to medical records.

```mermaid
flowchart TD
    DoctorDB["Doctor Dashboard"]
    
    DoctorDB --> D_Daily["Daily Schedule"]
    D_Daily --> D_Consult["Consultation ([id])"]
    D_Daily --> D_Emergencies["Emergency Alerts"]
    
    DoctorDB --> D_Management["Patient Management"]
    D_Management --> D_Search["Search Patients"]
    D_Management --> D_Patient["Patient Profile ([pid])"]
    
    DoctorDB --> D_Clinical["Clinical Actions"]
    D_Clinical --> D_Prescriptions["Manage Prescriptions"]
    D_Clinical --> D_FollowUps["Follow-ups"]
    D_Clinical --> D_CareTeams["Care Teams"]
```

**Tech Stack Used:**
*   **Backend APIs:** FastAPI routers (`appointments.py`, `consultations.py`, `patients.py`)
*   **Database:** PostgreSQL with SQLAlchemy ORM (JSONB used for flexible prescription lists)
*   **Real-time Updates:** TanStack Query for polling queue positions and emergency alerts
*   **Styling:** Next-themes for Dark/Light mode, optimizing visibility in clinical settings

---

## 4. Reception Flow

The reception interface acts as the operational hub for managing hospital logistics and patient throughput.

```mermaid
flowchart TD
    ReceptionDB["Reception Dashboard"]
    
    ReceptionDB --> R_Appointments["Appointments List"]
    ReceptionDB --> R_CheckIn["Check-in Desk"]
    ReceptionDB --> R_Waitlist["Waitlist Management"]
    
    ReceptionDB --> R_Hospital["Hospital Logistics"]
    R_Hospital --> R_Rooms["Room & Bed Status"]
    R_Hospital --> R_Journeys["Live Patient Journeys"]
    R_Hospital --> R_Emergencies["Escalations"]
```

**Tech Stack Used:**
*   **Frontend Data Grids:** ShadCN UI Data Tables (TanStack Table)
*   **Data Models:** Complex SQL joins in FastAPI (via SQLAlchemy) to aggregate queue and appointment data
*   **State Management:** React `useState` / `useEffect` for modal interactions (Check-in, Assign Room)
*   **Audit Logging:** Backend event tracking for all status changes

---

## 5. Pharmacy Flow

The pharmacy module handles medication fulfillment, inventory tracking, and billing.

```mermaid
flowchart TD
    PharmacyDB["Pharmacy Dashboard"]
    
    PharmacyDB --> PH_Dispense["Prescription Fulfillment"]
    PH_Dispense --> PH_Bills["Pharmacy Billing"]
    PH_Dispense --> PH_Dispensers["Smart Dispensers"]
    
    PharmacyDB --> PH_Management["Pharmacy Operations"]
    PH_Management --> PH_Inventory["Inventory Management"]
    PH_Management --> PH_Cost["Cost Analysis"]
```

**Tech Stack Used:**
*   **Backend APIs:** FastAPI `pharmacy.py` and `billing.py`
*   **Database Schema:** Advanced PostgreSQL relations linking Prescriptions to Bills and Inventory
*   **Payments (Mocked):** Integration points for external payment gateways (e.g., Razorpay, Stripe)
*   **Forms:** React Hook Form for updating stock levels and dispensing logic
