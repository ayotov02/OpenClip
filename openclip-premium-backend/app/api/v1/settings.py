import hashlib
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import generate_api_key
from app.models.api_key import UserApiKey
from app.models.social_account import SocialAccount
from app.models.user import User
from app.models.webhook import WebhookConfig
from app.schemas.common import (
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    SocialAccountCreate,
    SocialAccountResponse,
    WebhookConfigCreate,
    WebhookConfigResponse,
    WebhookConfigUpdate,
)

router = APIRouter(prefix="/settings", tags=["settings"])


# --- API Keys ---
@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_api_keys(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserApiKey).where(UserApiKey.user_id == user.id)
    )
    return result.scalars().all()


@router.post("/api-keys", response_model=ApiKeyCreatedResponse, status_code=201)
async def create_api_key(
    data: ApiKeyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_key, key_hash, prefix = generate_api_key()
    api_key = UserApiKey(
        user_id=user.id, name=data.name, key_hash=key_hash, key_prefix=prefix
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    resp = ApiKeyCreatedResponse.model_validate(api_key)
    resp.key = raw_key
    return resp


@router.delete("/api-keys/{key_id}", status_code=204)
async def delete_api_key(
    key_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserApiKey).where(UserApiKey.id == key_id, UserApiKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(key)
    await db.commit()


# --- Social Accounts ---
@router.get("/social-accounts", response_model=list[SocialAccountResponse])
async def list_social_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.user_id == user.id)
    )
    return result.scalars().all()


@router.post("/social-accounts", response_model=SocialAccountResponse, status_code=201)
async def create_social_account(
    data: SocialAccountCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = SocialAccount(user_id=user.id, **data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/social-accounts/{account_id}", status_code=204)
async def delete_social_account(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id, SocialAccount.user_id == user.id
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Social account not found")
    await db.delete(account)
    await db.commit()


# --- Webhooks ---
@router.get("/webhooks", response_model=list[WebhookConfigResponse])
async def list_webhooks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookConfig).where(WebhookConfig.user_id == user.id)
    )
    return result.scalars().all()


@router.post("/webhooks", response_model=WebhookConfigResponse, status_code=201)
async def create_webhook(
    data: WebhookConfigCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    wh = WebhookConfig(
        user_id=user.id,
        url=data.url,
        events=data.events,
        secret=secrets.token_urlsafe(32),
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


@router.delete("/webhooks/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookConfig).where(
            WebhookConfig.id == webhook_id, WebhookConfig.user_id == user.id
        )
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(wh)
    await db.commit()


# --- Instance Info ---
@router.get("/instance")
async def instance_info(user: User = Depends(get_current_user)):
    return {
        "mode": settings.APP_MODE,
        "version": settings.APP_VERSION,
    }
