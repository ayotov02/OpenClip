from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.common import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: integrate with LLM provider based on mode
    # mode: create, generate, compose, research
    return ChatResponse(
        response=f"[{data.mode}] AI response placeholder — provider integration pending",
        metadata={"mode": data.mode},
    )
