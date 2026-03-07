import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.brand.context import get_active_brand_context, get_brand_context_by_id
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.providers import get_llm_provider
from app.schemas.common import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

MODE_SYSTEM_PROMPTS = {
    "create": (
        "You are a creative video content strategist. Help the user brainstorm "
        "video ideas, plan content, and develop creative concepts for their brand."
    ),
    "generate": (
        "You are a content generation assistant. Help the user create scripts, "
        "titles, descriptions, hashtags, and other content for their videos."
    ),
    "compose": (
        "You are a professional copywriter. Help the user compose polished text "
        "for social media posts, video descriptions, emails, and marketing materials."
    ),
    "research": (
        "You are a market research analyst. Help the user research trends, "
        "competitors, audience insights, and content strategies in their niche."
    ),
}


@router.post("", response_model=ChatResponse)
async def chat(
    data: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Load brand context if provided, otherwise use active
    brand_ctx = None
    if data.brand_context_id:
        brand_ctx = await get_brand_context_by_id(db, data.brand_context_id)
    else:
        brand_ctx = await get_active_brand_context(db, user.id)

    # Build messages with mode-specific system prompt
    mode_prompt = MODE_SYSTEM_PROMPTS.get(data.mode, MODE_SYSTEM_PROMPTS["create"])
    messages = [
        {"role": "system", "content": mode_prompt},
        *[{"role": m.role, "content": m.content} for m in data.messages],
    ]

    llm = get_llm_provider()
    response = await llm.chat(messages, brand_ctx=brand_ctx)

    return ChatResponse(
        response=response,
        metadata={"mode": data.mode, "brand_context_id": str(brand_ctx.id) if brand_ctx else None},
    )
