"""
Seed script — populates MediFlow Smart Hospital per hospital.md + db-design.txt.

Run:
  python seed.py
  python seed.py --force
"""
import argparse
import asyncio

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import Base
from app.config import settings
from app.models import *  # noqa: F401,F403
from app.seed.hospital import seed_hospital

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed(force: bool = False):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        summary = await seed_hospital(session, force=force)
        return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed MediFlow Smart Hospital database")
    parser.add_argument("--force", action="store_true", help="Reset and reseed all data")
    args = parser.parse_args()
    asyncio.run(seed(force=args.force))
