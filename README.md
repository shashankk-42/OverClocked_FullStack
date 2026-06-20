# MediFlow AI: A Futuristic Hospital Operating System

![Hero Image - Placeholder for Dashboard Screenshot](/path/to/hero-image.png)
*(Insert a screenshot of the main dashboard here)*

**Track:** Full-Stack AI (Futuristic Hospital)

## 🏥 The Problem
Even with advanced medical technology, modern hospitals remain bogged down by operational inefficiencies:
1. **Siloed Systems:** Critical information doesn't flow instantly between Reception, Doctors, and Pharmacy.
2. **Patient Bottlenecks:** Patients struggle to navigate complex triage flows, often waiting hours just to see the wrong specialist.
3. **Doctor Burnout:** Doctors spend too much time on manual data entry and documentation instead of patient care.
4. **Supply Chain Friction:** Pharmacists hit delays when prescribed medications are out of stock and require doctor authorization for alternatives.

## 🚀 The Solution
MediFlow AI is an end-to-end, full-stack hospital operating system. It acts as a single source of truth connecting four major stakeholders: **Patients, Receptionists, Doctors, and Pharmacists**. By deeply integrating Generative AI (Gemini) into the core workflow, it automates triage, accelerates clinical documentation, and provides instant medication alternatives.

---

## 🌟 Key Features & User Flows

### 1. The Patient Portal: AI Symptom Triage
Instead of guessing which doctor to see, patients describe their symptoms in plain language.
*   **The AI Component:** The AI analyzes the symptoms, determines the medical urgency (Emergency, High, Medium, Low), and automatically recommends the correct department for booking.
*   **Impact:** Reduces wait times, prevents booking errors, and instantly flags emergency situations.

![Patient Booking - Placeholder](/path/to/patient-booking.png)
*(Insert a screenshot of the patient booking and AI triage flow here)*

### 2. The Doctor Dashboard: Streamlined Consultations
Doctors see their patient queue updated in real-time.
*   **The Workflow:** Doctors review the patient's AI triage summary and past medical history side-by-side. They use structured SOAP notes to document the visit and quickly generate a digital prescription.
*   **Impact:** Drastically reduces documentation time and administrative burden.

![Doctor Dashboard - Placeholder](/path/to/doctor-dashboard.png)
*(Insert a screenshot of the doctor consultation view here)*

### 3. The Pharmacy Dashboard: AI Substitutions
Prescriptions hit the pharmacy queue instantly—no paper required.
*   **The AI Component:** If a drug is out of stock, pharmacists click the **"AI Alternatives"** button. The AI evaluates the active ingredients against the patient's specific diagnosis to recommend safe, equivalent substitutes.
*   **Impact:** Eliminates the need to interrupt the doctor for a new prescription, speeding up patient discharge.

![Pharmacy Dashboard - Placeholder](/path/to/pharmacy-dashboard.png)
*(Insert a screenshot of the pharmacy queue and AI alternatives here)*

### 4. The Receptionist Dashboard: Queue Management
A bird's-eye view of all hospital traffic, active bookings, and check-ins, allowing administrators to manage flow smoothly.

---

## 🏗️ Technical Architecture & Stack

MediFlow AI uses a modern monorepo structure, separating a high-performance Python backend from a dynamic React frontend.

**Frontend (`/src/frontend`):**
*   **Framework:** Next.js 16 (App Router) with React 19 and TypeScript.
*   **Styling:** Tailwind CSS v4, utilizing a clean, high-contrast light theme.
*   **State Management:** `@tanstack/react-query` for handling async server state and polling live queues.
*   **UI Components:** `shadcn/ui`, `lucide-react`, `framer-motion`, `react-hook-form` with `zod`.

**Backend (`/src/backend`):**
*   **Framework:** FastAPI serving asynchronous REST endpoints via Uvicorn.
*   **Database:** PostgreSQL connected asynchronously via `asyncpg` and SQLAlchemy 2.0 ORM.
*   **AI Engine:** Google Generative AI (Gemini) for triage and medical reasoning.
*   **Security:** JWT Authentication (`python-jose`), password hashing (`bcrypt`), and strict Pydantic data validation.

![Architecture Diagram - Placeholder](/path/to/architecture-diagram.png)
*(Insert a high-level architecture diagram here if available)*

---

## 📁 Codebase Navigation

The repository is divided into two primary directories:

*   **`src/backend/`**: Contains the FastAPI application.
    *   `app/api/`: API route definitions (auth, appointments, consultations, ai).
    *   `app/core/`: Security, config, and database connection logic.
    *   `app/models/`: SQLAlchemy ORM database models.
    *   `app/schemas/`: Pydantic models for request/response validation.
    *   `app/services/`: Core business logic (including the AI integration service).
*   **`src/frontend/`**: Contains the Next.js frontend.
    *   `app/`: App router pages. Divided by role (`/patient`, `/doctor`, `/reception`, `/pharmacy`).
    *   `components/`: Reusable React components and layout shells.
    *   `lib/`: API clients (`api.ts`), utilities, and configuration.
    *   `contexts/`: React context providers (e.g., AuthContext).

---

## 🛠️ How to Run Locally

### Demo Credentials
All seeded demo accounts use `demo1234` as the password.
| Role | Login |
| --- | --- |
| Patient | `9876543210` |
| Doctor | `dr.sharma@mediflow.ai` |
| Reception | `reception@mediflow.ai` |
| Pharmacy | `pharmacist@mediflow.ai` |
| Admin | `admin@mediflow.ai` |

### Using Docker (Recommended)
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
2. **Crucial:** Add your `GEMINI_API_KEY` in `.env` to enable the AI features.
3. Start the entire stack:
   ```bash
   docker compose up --build
   ```
4. Once the backend is healthy, seed the database with demo data:
   ```bash
   docker compose exec backend python seed.py
   ```
5. Open the app:
   * **Frontend:** http://localhost:3000
   * **Backend Docs:** http://localhost:8000/docs

### Manual Setup
If you prefer running without Docker:
1. Ensure PostgreSQL is running.
2. **Backend:**
   ```bash
   cd src/backend
   python -m venv .venv
   source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   python seed.py
   uvicorn app.main:app --reload --port 8000
   ```
3. **Frontend:**
   ```bash
   cd src/frontend
   npm install
   npm run dev
   ```