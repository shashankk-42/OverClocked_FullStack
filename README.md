# MediFlow AI

MediFlow AI is a full-stack hospital operating system MVP with a FastAPI backend, PostgreSQL database, Next.js frontend, JWT demo auth, and Gemini-powered clinical assistance.

## What Is Included

- Patient registration, login, PID card, appointment booking, history, and AI chat.
- Doctor dashboard with queue view, patient summaries, SOAP notes, and prescription generation.
- Reception dashboard with appointment queue and check-in workflows.
- Pharmacy dashboard with prescription dispensing, simulated billing, AI alternatives, and inventory tracking.
- Docker Compose orchestration for PostgreSQL, backend, and frontend.

## Demo Credentials

All seeded demo accounts use `demo1234` as the password.

| Role | Login |
| --- | --- |
| Patient | `9876543210` |
| Doctor | `dr.sharma@mediflow.ai` |
| Reception | `reception@mediflow.ai` |
| Pharmacy | `pharmacist@mediflow.ai` |
| Admin | `admin@mediflow.ai` |

## Run With Docker

1. Copy the environment template:

```powershell
Copy-Item .env.example .env
```

2. Add `GEMINI_API_KEY` in `.env` if you want live AI responses.

3. Start the stack:

```powershell
docker compose up --build
```

4. Seed demo data after the backend is healthy:

```powershell
docker compose exec backend python seed.py
```

5. Open:

- Frontend: http://localhost:3000
- Backend docs: http://localhost:8000/docs

## Run Locally

Start PostgreSQL with Docker:

```powershell
docker compose up db
```

Backend:

```powershell
cd src/backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd src/frontend
npm install
npm run dev
```

## Verification

```powershell
cd src/backend
python -m compileall app

cd ..\frontend
npm run build
npm run lint
```
