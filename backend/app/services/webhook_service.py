import hashlib
import hmac
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.webhook import WebhookConfig


async def get_webhooks(db: AsyncSession, user_id: uuid.UUID) -> list[WebhookConfig]:
    result = await db.execute(
        select(WebhookConfig).where(WebhookConfig.user_id == user_id)
    )
    return list(result.scalars().all())


async def dispatch_event(
    db: AsyncSession, user_id: uuid.UUID, event: str, payload: dict
) -> None:
    webhooks = await get_webhooks(db, user_id)
    async with httpx.AsyncClient(timeout=10) as client:
        for wh in webhooks:
            if not wh.is_active or (wh.events and event not in wh.events):
                continue
            body = {"event": event, "data": payload}
            signature = hmac.new(
                wh.secret.encode(), str(body).encode(), hashlib.sha256
            ).hexdigest()
            try:
                await client.post(
                    wh.url,
                    json=body,
                    headers={"X-Webhook-Signature": signature},
                )
            except httpx.RequestError:
                pass
