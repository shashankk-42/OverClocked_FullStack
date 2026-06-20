import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth.jwt import verify_token
from app.db.session import get_db
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = verify_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_role(*roles: str):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return current_user

    return role_checker


def get_current_patient(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    return current_user


def get_current_doctor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    return current_user


def get_current_staff(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("doctor", "receptionist", "pharmacist", "nurse", "admin"):
        raise HTTPException(status_code=403, detail="Staff only")
    return current_user
