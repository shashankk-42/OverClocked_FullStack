# MediFlow AI — Codebase & Runtime Reference

---

## 1. Repository Structure

```
ethosh/
├── .AI/                          # AI context, skills, tasks (this directory)
│   ├── context/                  # Architecture, tech stack, gotchas, etc.
│   ├── skills/                   # Coding skill references
│   └── tasks/                    # Active and historical task plans
│
├── src/
│   ├── frontend/                 # Next.js application
│   │   ├── app/                  # App Router pages & layouts
│   │   ├── components/           # React components (feature + shared)
│   │   ├── lib/                  # Utilities, API client, helpers
│   │   ├── hooks/                # Custom React hooks
│   │   ├── types/                # TypeScript type definitions
│   │   ├── styles/               # Global CSS, Tailwind config
│   │   ├── public/               # Static assets (images, fonts)
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── components.json       # ShadCN UI configuration
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── backend/                  # FastAPI application
│       ├── app/
│       │   ├── main.py           # FastAPI app factory + lifespan
│       │   ├── config.py         # Pydantic BaseSettings (env vars)
│       │   ├── auth/             # Clerk integration, role guards, OTP
│       │   ├── services/         # Business logic (patient, appointment, etc.)
│       │   ├── ai/               # Gemini AI modules
│       │   ├── models/           # SQLAlchemy ORM models
│       │   ├── schemas/          # Pydantic request/response schemas
│       │   ├── routers/          # FastAPI route handlers
│       │   └── db/               # Database session, migrations
│       ├── tests/                # pytest test suite
│       ├── alembic.ini
│       ├── requirements.txt
│       └── Dockerfile
│
├── docker-compose.yml            # Full-stack orchestration
├── docker-compose.dev.yml        # Dev overrides (hot reload, debug)
├── nginx/
│   └── nginx.conf                # Reverse proxy configuration
├── AGENT.md                      # Agent workflow contract
├── .env.example                  # Environment variable template
├── .gitignore
└── README.md
```

---

## 2. Local Development Setup

### Prerequisites


| Tool           | Version | Check                    |
| -------------- | ------- | ------------------------ |
| Node.js        | 18+     | `node --version`         |
| Python         | 3.11+   | `python --version`       |
| PostgreSQL     | 15+     | `psql --version`         |
| Docker         | 24+     | `docker --version`       |
| Docker Compose | 2.x     | `docker compose version` |


### Quick Start (Docker)

```bash
# 1. Clone and enter project
git clone https://github.com/shashankk-42/OverClocked_FullStack.git
cd ethosh

# 2. Copy environment template
cp .env.example .env
# Fill in: GEMINI_API_KEY, CLERK keys, RAZORPAY keys, SUPABASE keys

# 3. Start all services
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 4. Run database migrations
docker compose exec backend alembic upgrade head

# 5. Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000/docs (Swagger)
# Database: localhost:5432
```

### Quick Start (Local — No Docker)

```bash
# Frontend
cd src/frontend
npm install
npm run dev                    # → http://localhost:3000

# Backend (separate terminal)
cd src/backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

---

## 3. Runtime Configuration

### Environment Variables


| Variable                            | Required | Default                        | Description                     |
| ----------------------------------- | -------- | ------------------------------ | ------------------------------- |
| `DATABASE_URL`                      | Yes      | —                              | PostgreSQL connection string    |
| `GEMINI_API_KEY`                    | Yes      | —                              | Google Gemini API key           |
| `CLERK_SECRET_KEY`                  | Yes      | —                              | Clerk backend secret            |
| `CLERK_WEBHOOK_SECRET`              | Yes      | —                              | Clerk webhook verification      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes      | —                              | Clerk frontend key              |
| `SUPABASE_URL`                      | Yes      | —                              | Supabase project URL            |
| `SUPABASE_SERVICE_KEY`              | Yes      | —                              | Supabase service role key       |
| `RAZORPAY_KEY_ID`                   | Yes      | —                              | Razorpay merchant key           |
| `RAZORPAY_KEY_SECRET`               | Yes      | —                              | Razorpay merchant secret        |
| `NEXT_PUBLIC_API_URL`               | No       | `http://localhost:8000/api/v1` | Backend API base URL            |
| `LOG_LEVEL`                         | No       | `INFO`                         | Python logging level            |
| `CORS_ORIGINS`                      | No       | `http://localhost:3000`        | Comma-separated allowed origins |


---

## 4. Key Commands

### Frontend

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright E2E tests
```

### Backend

```bash
uvicorn app.main:app --reload           # Dev server (port 8000)
pytest                                   # Run all tests
pytest -x -v                             # Stop on first failure, verbose
alembic revision --autogenerate -m "msg" # Generate migration
alembic upgrade head                     # Apply migrations
alembic downgrade -1                     # Rollback last migration
ruff check .                             # Lint
ruff format .                            # Format
mypy app/                                # Type check
```

### Docker

```bash
docker compose up -d                     # Start all services
docker compose down                      # Stop all services
docker compose logs -f backend           # Tail backend logs
docker compose exec backend pytest       # Run tests in container
docker compose exec db psql -U postgres  # Connect to PostgreSQL
```

---

## 5. Database Access

### Connection String Format

```
postgresql+asyncpg://user:password@host:port/mediflow_db
```

### Useful Queries (Dev)

```sql
-- Check all patients
SELECT pid, name, phone, created_at FROM patients ORDER BY created_at DESC LIMIT 20;

-- Today's appointments
SELECT a.id, p.name, d.name as doctor, a.date, a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN doctors d ON a.doctor_id = d.id
WHERE a.date::date = CURRENT_DATE;

-- Pending prescriptions (pharmacy queue)
SELECT rx.id, p.name, rx.medicines, rx.created_at
FROM prescriptions rx
JOIN patients p ON rx.patient_id = p.id
WHERE rx.status = 'pending'
ORDER BY rx.created_at;
```

---

## 6. Logging

### Backend Logging Convention

```python
import logging
logger = logging.getLogger(__name__)

# Levels:
# DEBUG   → detailed diagnostic (AI prompts, full responses)
# INFO    → normal operations (patient registered, appointment booked)
# WARNING → recoverable issues (Gemini slow response, low stock)
# ERROR   → failures (payment verification failed, DB connection lost)
```

### Structured Logging Fields

Always include context:

```python
logger.info("Appointment booked", extra={
    "patient_pid": pid,
    "doctor_id": doctor_id,
    "slot": slot,
})
```

---

## 7. Testing Strategy


| Layer               | Framework  | Location                         | Coverage Target            |
| ------------------- | ---------- | -------------------------------- | -------------------------- |
| Backend Unit        | pytest     | `src/backend/tests/unit/`        | Services, AI modules       |
| Backend Integration | pytest     | `src/backend/tests/integration/` | API endpoints with test DB |
| Frontend Unit       | Vitest     | `src/frontend/__tests__/`        | Components, hooks, utils   |
| Frontend E2E        | Playwright | `src/frontend/e2e/`              | Critical user flows        |


### Running Tests

```bash
# Backend — with coverage
cd src/backend
pytest --cov=app --cov-report=term-missing

# Frontend — unit
cd src/frontend
npm run test

# Frontend — E2E
npm run test:e2e
```

