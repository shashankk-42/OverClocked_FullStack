# MediFlow AI — Technology Stack

---

## Frontend

| Technology | Version | Purpose |
| ---------- | ------- | ------- |
| **Next.js** | 14+ (App Router) | Full-stack React framework; SSR, routing, API routes |
| **React** | 18+ | Component-based UI library |
| **Tailwind CSS** | 3.x | Utility-first CSS framework |
| **ShadCN UI** | Latest | Accessible, composable component library (built on Radix) |
| **TypeScript** | 5.x | Type safety across the frontend |
| **Lucide React** | Latest | Icon library (pairs with ShadCN) |
| **React Hook Form** | Latest | Form management + validation |
| **Zod** | Latest | Schema validation (shared with ShadCN form patterns) |
| **TanStack Query** | v5 | Server-state management, caching, optimistic updates |
| **next-themes** | Latest | Dark/light mode theming |

### Frontend Dev Tools

| Tool | Purpose |
| ---- | ------- |
| ESLint | Linting (Next.js config) |
| Prettier | Code formatting |
| Vitest | Unit testing |
| Playwright | E2E testing |

---

## Backend

| Technology | Version | Purpose |
| ---------- | ------- | ------- |
| **Python** | 3.11+ | Primary backend language |
| **FastAPI** | 0.100+ | Async REST API framework with auto OpenAPI docs |
| **Uvicorn** | Latest | ASGI server for FastAPI |
| **Pydantic** | v2 | Request/response validation, settings management |
| **SQLAlchemy** | 2.x | Async ORM for PostgreSQL |
| **Alembic** | Latest | Database migration management |
| **python-jose** | Latest | JWT token handling |
| **httpx** | Latest | Async HTTP client (Gemini, Clerk webhooks) |
| **python-multipart** | Latest | File upload handling |

### Backend Dev Tools

| Tool | Purpose |
| ---- | ------- |
| pytest | Unit + integration testing |
| pytest-asyncio | Async test support |
| ruff | Linting + formatting |
| mypy | Static type checking |

---

## Database

| Technology | Purpose |
| ---------- | ------- |
| **PostgreSQL** | Primary relational database — ACID compliance for medical data |
| **Alembic** | Schema migrations |

### Key Design Choices

- UUIDs as primary keys (avoid sequential ID leakage)
- `JSONB` columns for flexible prescription medicine lists
- Timestamps with timezone on all records
- Soft deletes on patient-facing data (audit trail)

---

## Authentication & Authorization

| Technology | Purpose |
| ---------- | ------- |
| **Clerk** | User management, session handling, role assignment |
| **Phone OTP** | Patient login (via Clerk) |
| **Email/Password** | Staff login (via Clerk) |
| **JWT** | Stateless API authentication |
| **RBAC** | Role-based access control — 6 roles: `patient`, `receptionist`, `doctor`, `nurse`, `pharmacist`, `admin` |

---

## AI / ML

| Technology | Purpose |
| ---------- | ------- |
| **Google Gemini 2.5 Pro** | Complex AI tasks: patient summary, report analysis, SOAP notes |
| **Google Gemini Flash** | Low-latency tasks: triage, Rx explanation, drug interaction checks |
| **google-generativeai SDK** | Python SDK for Gemini API |

### AI Module → Model Mapping

| Module | Model | Why |
| ------ | ----- | --- |
| Symptom Triage | Flash | Speed-critical; simple classification |
| Patient Summary | 2.5 Pro | Complex reasoning over full history |
| Report Analyzer | 2.5 Pro | PDF parsing + medical interpretation |
| SOAP Notes | 2.5 Pro | Structured clinical note generation |
| Rx Explainer | Flash | Short, simple text transformation |
| Drug Interaction | Flash | Lookup + pattern matching |
| Alt-Medicine | Flash | Contextual substitution suggestions |

---

## Storage

| Technology | Purpose |
| ---------- | ------- |
| **Supabase Storage** | Medical report uploads (PDFs, images, lab results) |

### File Handling

- Uploads validated for type (`application/pdf`, `image/*`) and size (max 10 MB)
- Files stored with patient PID prefix for organized retrieval
- Supabase RLS policies restrict access to authorized roles

---

## Payments

| Technology | Purpose |
| ---------- | ------- |
| **Razorpay** | Payment gateway for pharmacy billing |
| **Razorpay SDK** | Server-side order creation + verification |

### Payment Flow

```
Bill Created → Razorpay Order → Client Payment → Webhook Verification → Bill Updated
```

---

## Infrastructure & Deployment

| Technology | Purpose |
| ---------- | ------- |
| **Docker** | Containerization for all services |
| **Docker Compose** | Multi-container orchestration (dev + staging) |
| **Nginx** | Reverse proxy, TLS termination, static asset serving |
| **GitHub Actions** | CI/CD pipeline |
| **Vercel** (optional) | Next.js hosting alternative |

### Container Layout

```
docker-compose.yml
├── frontend   (Next.js — port 3000)
├── backend    (FastAPI — port 8000)
├── db         (PostgreSQL — port 5432)
└── nginx      (Reverse proxy — port 80/443)
```

---

## Environment Variables

### Frontend (.env.local)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
```

### Backend (.env)

```
DATABASE_URL=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
GEMINI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```
