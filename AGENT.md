# MediFlow AI — Agent Workflow Contract

> This document defines how AI coding agents should operate within the MediFlow AI codebase.

---

## 1. Identity

You are working on **MediFlow AI**, an AI-powered Hospital Operating System. Before making any changes, always read the relevant context files in `.AI/context/`.

---

## 2. Context Loading Order

Before starting any task, read these files in order:

1. `.AI/context/index.md` — File index and navigation
2. `.AI/context/ARCHITECTURE.md` — System architecture overview
3. `.AI/context/Techstack.md` — Technology choices and versions
4. `.AI/context/gotchas.md` — Critical pitfalls and conventions
5. `.AI/context/codebase-and-runtime.md` — Repository structure, commands, environment

Load additional context based on the task:

- **Frontend work** → `.AI/context/FRONTEND_REFERENCE.md`
- **Backend / AI work** → `.AI/context/pipeline-and-architecture.md`
- **Feature scoping** → `.AI/context/product-and-mvp.md`
- **Full PRD** → `.AI/context/MediFlowPRD.md`

---

## 3. Code Standards

### Frontend (TypeScript / Next.js)

- Use **TypeScript** for all files — no `.js` or `.jsx`
- Use **Next.js App Router** conventions (server components by default)
- Add `"use client"` only when the component needs interactivity
- Use **ShadCN UI** components from `/components/ui/` — don't build custom primitives
- Use **TanStack Query** for all server state — no `useEffect` for data fetching
- Use **Zod** schemas for form validation (paired with React Hook Form)
- Follow the route structure defined in `FRONTEND_REFERENCE.md`
- All interactive elements must have unique `id` attributes

### Backend (Python / FastAPI)

- Use **async/await** throughout — no synchronous database calls
- Use **Pydantic v2** models for all request/response schemas
- Use **SQLAlchemy 2.x async** for database operations
- Use **FastAPI dependency injection** for auth guards — not decorators
- All API routes follow REST conventions: plural nouns, consistent verbs
- Error responses follow the standard shape: `{ detail, code, field? }`
- Log with context: always include `patient_pid`, `doctor_id`, or `request_id`

### AI Modules

- Always use **Gemini Flash** for latency-critical calls (triage, explanations)
- Always use **Gemini 2.5 Pro** for complex analysis (summaries, reports, SOAP)
- Never send raw patient identifiers (name, phone) to Gemini — use anonymized context
- Always validate and parse AI responses — never trust raw LLM output
- Implement retry with exponential backoff (max 3 attempts) for AI calls
- Provide graceful fallback when AI is unavailable

### Database

- All primary keys are **UUIDs**
- All tables have `created_at` and `updated_at` timestamps (UTC)
- Use **soft deletes** for patient-facing data
- Prescription `medicines` column is **JSONB** — not a foreign key
- Always use transactions for multi-step operations
- Generate migrations with Alembic — never modify the DB schema manually

---

## 4. File Organization Rules

```
# New feature files go here:
src/frontend/components/{role}/          # Role-specific components
src/frontend/app/({role})/               # Role-specific pages
src/backend/app/services/{service}.py    # Business logic
src/backend/app/routers/{router}.py      # API endpoints
src/backend/app/ai/{module}.py           # AI modules
src/backend/app/models/{model}.py        # ORM models
src/backend/app/schemas/{schema}.py      # Pydantic schemas

# Shared utilities:
src/frontend/lib/                        # Frontend utilities
src/frontend/hooks/                      # Custom hooks
src/backend/app/db/                      # Database utilities
```

---

## 5. Task Execution Workflow

### Before Writing Code

1. Read relevant context files (see §2)
2. Understand the current task scope
3. Check `gotchas.md` for relevant pitfalls
4. Identify which services / components are affected

### While Writing Code

1. Follow code standards (see §3)
2. Write tests alongside implementation
3. Handle errors explicitly — no silent failures
4. Add logging for important operations
5. Update context files if architecture decisions change

### After Writing Code

1. Run linting (`ruff check .` / `npm run lint`)
2. Run tests (`pytest` / `npm run test`)
3. Verify the change works end-to-end
4. Update `.AI/tasks/active/TASK.md` with progress

---

## 6. Commit Conventions

```
feat(scope): description     # New feature
fix(scope): description      # Bug fix
refactor(scope): description # Code improvement
docs(scope): description     # Documentation
test(scope): description     # Test addition/fix
chore(scope): description    # Build, config, deps
```

**Scopes:** `patient`, `doctor`, `reception`, `pharmacy`, `admin`, `ai`, `auth`, `db`, `infra`

---

## 7. Security Rules (Non-Negotiable)

- **Never** expose stack traces to clients
- **Never** log patient PII (name, phone, DOB) at INFO level — use DEBUG only
- **Never** skip Clerk webhook signature verification
- **Never** trust client-side payment status — always verify server-side
- **Never** allow direct SQL queries from user input — always parameterize
- **Always** validate file uploads (type + size) before storage
- **Always** enforce RBAC on every endpoint
- **Always** use HTTPS in production
- **Always** set Gemini API to no-storage mode for patient data

---

## 8. When In Doubt

1. Check `gotchas.md` first
2. Follow the existing patterns in the codebase
3. Prefer security over convenience
4. Prefer explicit over clever
5. Ask the developer if the requirement is ambiguous
