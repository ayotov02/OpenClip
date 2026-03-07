from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clerk import verify_clerk_token
from app.core.database import get_db
from app.models.user import User


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Premium auth uses Clerk JWT verification."""
    return await verify_clerk_token(request, db)


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    try:
        return await verify_clerk_token(request, db)
    except Exception:
        return None
