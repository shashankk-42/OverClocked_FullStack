# Active Task

**MediFlow AI — MVP Build**

## Status

Project initialized. Context documents populated. Ready for implementation.

## Completed

- [x] Pull repository from GitHub
- [x] Create system architecture document (`ARCHITECTURE.md`)
- [x] Define technology stack (`Techstack.md`)
- [x] Document gotchas and guardrails (`gotchas.md`)
- [x] Create frontend reference (`FRONTEND_REFERENCE.md`)
- [x] Document codebase and runtime setup (`codebase-and-runtime.md`)
- [x] Define pipelines and data flow (`pipeline-and-architecture.md`)
- [x] Define product scope and MVP features (`product-and-mvp.md`)
- [x] Create agent workflow contract (`AGENT.md`)
- [x] Create and populate context index (`index.md`)

## Next Steps

- [ ] Initialize Next.js frontend (`src/frontend/`)
- [ ] Initialize FastAPI backend (`src/backend/`)
- [ ] Set up PostgreSQL schema + Alembic migrations
- [ ] Implement Clerk authentication (Patient OTP + Staff login)
- [ ] Build Patient Registration + PID generation
- [ ] Build AI Triage module (Gemini Flash)
- [ ] Build Appointment Booking flow
- [ ] Build Reception Check-In + Queue Management
- [ ] Build Doctor Dashboard (Patient Summary, SOAP Notes, Rx Generator)
- [ ] Build Pharmacy Dashboard (Prescription Viewer, Dispensing, Alt-Medicine)
- [ ] Build Billing + Razorpay Integration
- [ ] Set up Docker Compose for full-stack orchestration
- [ ] Write tests (pytest + Vitest + Playwright)

## Source of Truth

1. `.AI/context/index.md` (navigation hub)
2. `AGENT.md` (agent workflow contract)
3. `.AI/context/ARCHITECTURE.md` (system design)
4. `.AI/context/product-and-mvp.md` (feature scope)
