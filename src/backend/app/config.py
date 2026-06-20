from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://mediflow:mediflow123@localhost:5432/mediflow_db"

    # JWT
    secret_key: str = "super-secret-key-change-in-production-mediflow-ai-2026"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Gemini AI
    gemini_api_key: str = ""

    # App
    app_name: str = "MediFlow AI"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # File storage
    uploads_dir: str = "uploads"

    # Demo/dev data
    seed_demo_data: bool = True

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    consultation_fee: float = 500.0
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
