import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.db.session import init_db
from app.routers import auth, patients, appointments, consultations, pharmacy, ai, enhancements

# Import all models to register them with SQLAlchemy metadata
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.uploads_dir, exist_ok=True)
    await init_db()
    if settings.seed_demo_data:
        try:
            from seed import seed

            await seed()
        except Exception as exc:
            if settings.debug:
                raise
            print(f"Demo seed skipped: {exc}")
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title="MediFlow AI",
    description="AI-powered Hospital Operating System API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (QR codes, uploads)
if os.path.exists(settings.uploads_dir):
    app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
app.include_router(appointments.router, prefix="/api/v1")
app.include_router(consultations.router, prefix="/api/v1")
app.include_router(pharmacy.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(enhancements.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {
        "service": "MediFlow AI API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
