import uuid

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User


async def verify_clerk_token(request: Request, db: AsyncSession) -> User:
    """Verify Clerk JWT and return or create local user."""
    from clerk_backend_api import Clerk

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing auth token"
        )

    token = auth_header.removeprefix("Bearer ")
    clerk = Clerk(bearer_auth=settings.CLERK_SECRET_KEY)

    try:
        session_claims = clerk.sessions.verify_token(token)
        clerk_user = clerk.users.get(user_id=session_claims.sub)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Clerk token"
        )

    # Get or create local user
    result = await db.execute(
        select(User).where(User.clerk_id == clerk_user.id)
    )
    user = result.scalar_one_or_none()

    if not user:
        email = (
            clerk_user.email_addresses[0].email_address
            if clerk_user.email_addresses
            else ""
        )
        user = User(
            clerk_id=clerk_user.id,
            email=email,
            name=f"{clerk_user.first_name or ''} {clerk_user.last_name or ''}".strip(),
            avatar_url=clerk_user.image_url,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user
