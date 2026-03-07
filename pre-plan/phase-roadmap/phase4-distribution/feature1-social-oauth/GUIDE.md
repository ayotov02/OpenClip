# Social OAuth — Implementation Guide

## Overview
- **What:** Implement OAuth 2.0 authentication flows for YouTube, TikTok, Instagram (via Facebook), Facebook Pages, LinkedIn, and X (Twitter) so users can connect their social accounts for publishing and analytics.
- **Why:** OAuth is the prerequisite for every distribution feature. Without authenticated platform connections, we cannot publish content, read analytics, or track performance. Each platform has unique OAuth quirks, token lifetimes, and scope requirements.
- **Dependencies:** Phase 1 Feature 2 (FastAPI Backend), Phase 1 Feature 8 (React Frontend), PostgreSQL database with users table.

## Architecture

### System Design
```
Frontend (Next.js)                     Backend (FastAPI)                    Platform
  │                                       │                                   │
  │  1. User clicks "Connect YouTube"     │                                   │
  │──────────────────────────────────────>│                                   │
  │  2. Returns OAuth URL with state      │                                   │
  │<──────────────────────────────────────│                                   │
  │  3. Opens popup → redirects to platform                                   │
  │──────────────────────────────────────────────────────────────────────────>│
  │                                       │  4. User authorizes               │
  │                                       │<──────────────────────────────────│
  │                                       │  5. Callback with auth code       │
  │                                       │  6. Exchange code for tokens      │
  │                                       │──────────────────────────────────>│
  │                                       │  7. Access + refresh token        │
  │                                       │<──────────────────────────────────│
  │                                       │  8. Encrypt & store in PostgreSQL │
  │  9. Popup closes, parent refreshes    │                                   │
  │<──────────────────────────────────────│                                   │
```

### Data Flow
```
User clicks Connect → GET /api/v1/oauth/{platform}/authorize
  → Returns authorization URL with PKCE code_verifier + state token
  → Popup opens URL → User authorizes on platform
  → Platform redirects to GET /api/v1/oauth/{platform}/callback
  → Backend exchanges auth code for access_token + refresh_token
  → Tokens encrypted with Fernet (AES-128-CBC) and stored in social_accounts table
  → Backend returns HTML that sends postMessage to parent window → popup closes
  → Parent window refreshes connected accounts list
```

### Token Refresh Strategy
```
Before any API call:
  1. Check if access_token expires within 5 minutes
  2. If yes → use refresh_token to get new access_token
  3. If refresh fails → mark account as "disconnected", notify user
  4. If no refresh_token (TikTok v1) → re-auth required

Celery Beat: Every 30 minutes, refresh tokens expiring within 1 hour
```

## Platform-Specific Requirements

### YouTube (Google OAuth 2.0)
- **Auth URL:** `https://accounts.google.com/o/oauth2/v2/auth`
- **Token URL:** `https://oauth2.googleapis.com/token`
- **Scopes:** `youtube.upload youtube.readonly youtube youtube.force-ssl`
- **Token lifetime:** Access: 1 hour, Refresh: no expiry (unless revoked)
- **Notes:** Requires Google Cloud Console project with YouTube Data API v3 enabled. Must submit for verification if >100 users.

### TikTok (OAuth 2.0 via Login Kit)
- **Auth URL:** `https://www.tiktok.com/v2/auth/authorize/`
- **Token URL:** `https://open.tiktokapis.com/v2/oauth/token/`
- **Scopes:** `user.info.basic,video.publish,video.upload,video.list`
- **Token lifetime:** Access: 24 hours, Refresh: 365 days
- **Notes:** Must register on TikTok Developer Portal. Content Posting API requires approval. Uses `client_key` instead of `client_id`.

### Instagram (via Facebook Graph API)
- **Auth URL:** `https://www.facebook.com/v21.0/dialog/oauth`
- **Token URL:** `https://graph.facebook.com/v21.0/oauth/access_token`
- **Scopes:** `instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement`
- **Token lifetime:** Short-lived: 1 hour, Long-lived: 60 days
- **Notes:** Requires Facebook App with Instagram Graph API. Must exchange short-lived token for long-lived token. Only works with Instagram Business/Creator accounts linked to Facebook Pages.

### Facebook Pages
- **Auth URL:** `https://www.facebook.com/v21.0/dialog/oauth`
- **Token URL:** `https://graph.facebook.com/v21.0/oauth/access_token`
- **Scopes:** `pages_manage_posts,pages_read_engagement,pages_show_list`
- **Token lifetime:** Page tokens are long-lived (~60 days), can be exchanged for never-expiring page token
- **Notes:** After user auth, must call `/me/accounts` to get page-specific access tokens.

### LinkedIn (OAuth 2.0)
- **Auth URL:** `https://www.linkedin.com/oauth/v2/authorization`
- **Token URL:** `https://www.linkedin.com/oauth/v2/accessToken`
- **Scopes:** `openid profile w_member_social`
- **Token lifetime:** Access: 60 days, Refresh: 365 days
- **Notes:** Uses Community Management API for posting. Requires LinkedIn App approval.

### X / Twitter (OAuth 2.0 with PKCE)
- **Auth URL:** `https://twitter.com/i/oauth2/authorize`
- **Token URL:** `https://api.twitter.com/2/oauth2/token`
- **Scopes:** `tweet.read tweet.write users.read offline.access`
- **Token lifetime:** Access: 2 hours, Refresh: 6 months
- **Notes:** Requires OAuth 2.0 with PKCE (no client secret for public clients). Must use `code_challenge` and `code_verifier`. Free tier allows 1,500 tweets/month.

## Step-by-Step Implementation

### Step 1: Install Dependencies

Add to `backend/requirements.txt`:
```
cryptography>=43.0.0
authlib>=1.4.0
```

### Step 2: Add OAuth Configuration

Update `backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ... existing settings ...

    # Encryption key for OAuth tokens (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    TOKEN_ENCRYPTION_KEY: str = ""

    # OAuth: YouTube / Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/oauth/youtube/callback"

    # OAuth: TikTok
    TIKTOK_CLIENT_KEY: str = ""
    TIKTOK_CLIENT_SECRET: str = ""
    TIKTOK_REDIRECT_URI: str = "http://localhost:8000/api/v1/oauth/tiktok/callback"

    # OAuth: Facebook / Instagram
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""
    FACEBOOK_REDIRECT_URI: str = "http://localhost:8000/api/v1/oauth/facebook/callback"
    INSTAGRAM_REDIRECT_URI: str = "http://localhost:8000/api/v1/oauth/instagram/callback"

    # OAuth: LinkedIn
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_REDIRECT_URI: str = "http://localhost:8000/api/v1/oauth/linkedin/callback"

    # OAuth: X / Twitter
    X_CLIENT_ID: str = ""
    X_CLIENT_SECRET: str = ""
    X_REDIRECT_URI: str = "http://localhost:8000/api/v1/oauth/x/callback"

    # Frontend URL for popup callback
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
```

### Step 3: Create Token Encryption Service

Create `backend/app/services/token_encryption.py`:
```python
from cryptography.fernet import Fernet

from app.core.config import settings


class TokenEncryption:
    """Encrypt/decrypt OAuth tokens at rest using Fernet (AES-128-CBC + HMAC)."""

    def __init__(self):
        if not settings.TOKEN_ENCRYPTION_KEY:
            raise ValueError("TOKEN_ENCRYPTION_KEY must be set in environment")
        self._fernet = Fernet(settings.TOKEN_ENCRYPTION_KEY.encode())

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        return self._fernet.decrypt(ciphertext.encode()).decode()


token_encryption = TokenEncryption()
```

### Step 4: Create Social Account Database Model

Create `backend/app/models/social_account.py`:
```python
import enum
from datetime import datetime

from sqlalchemy import String, Enum, ForeignKey, Text, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class Platform(str, enum.Enum):
    YOUTUBE = "youtube"
    TIKTOK = "tiktok"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"
    X = "x"


class SocialAccount(BaseModel):
    __tablename__ = "social_accounts"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    platform: Mapped[Platform] = mapped_column(Enum(Platform), nullable=False)
    platform_user_id: Mapped[str] = mapped_column(String(255), nullable=False)
    platform_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform_display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform_avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Encrypted tokens
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # For Facebook Pages / Instagram — page-specific token
    page_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    page_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    page_access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    disconnected_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

### Step 5: Create Alembic Migration

```bash
cd backend
alembic revision --autogenerate -m "add social_accounts table"
alembic upgrade head
```

### Step 6: Create OAuth State Manager

Create `backend/app/services/oauth_state.py`:
```python
import hashlib
import secrets
import json
from datetime import datetime, timedelta, timezone

import redis.asyncio as redis

from app.core.config import settings


class OAuthStateManager:
    """Manage OAuth state tokens in Redis with PKCE support."""

    def __init__(self):
        self._redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

    async def create_state(
        self, user_id: str, platform: str, extra_data: dict | None = None
    ) -> dict:
        """Generate state token and optional PKCE verifier."""
        state = secrets.token_urlsafe(32)
        code_verifier = secrets.token_urlsafe(64)
        code_challenge = (
            hashlib.sha256(code_verifier.encode())
            .digest()
            .__class__
            .__bases__[0]
            .__subclasses__()
        )
        # Proper S256 code challenge
        import base64
        code_challenge = (
            base64.urlsafe_b64encode(
                hashlib.sha256(code_verifier.encode()).digest()
            )
            .rstrip(b"=")
            .decode()
        )

        data = {
            "user_id": user_id,
            "platform": platform,
            "code_verifier": code_verifier,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **(extra_data or {}),
        }

        # Store with 10-minute TTL
        await self._redis.setex(
            f"oauth_state:{state}",
            600,
            json.dumps(data),
        )

        return {
            "state": state,
            "code_verifier": code_verifier,
            "code_challenge": code_challenge,
        }

    async def validate_state(self, state: str) -> dict | None:
        """Validate and consume state token (one-time use)."""
        key = f"oauth_state:{state}"
        data = await self._redis.get(key)
        if not data:
            return None
        # Delete immediately — one-time use
        await self._redis.delete(key)
        return json.loads(data)


oauth_state_manager = OAuthStateManager()
```

### Step 7: Create OAuth Platform Clients

Create `backend/app/services/oauth/__init__.py`:
```python
from app.services.oauth.youtube import YouTubeOAuth
from app.services.oauth.tiktok import TikTokOAuth
from app.services.oauth.instagram import InstagramOAuth
from app.services.oauth.facebook import FacebookOAuth
from app.services.oauth.linkedin import LinkedInOAuth
from app.services.oauth.x import XOAuth

__all__ = [
    "YouTubeOAuth",
    "TikTokOAuth",
    "InstagramOAuth",
    "FacebookOAuth",
    "LinkedInOAuth",
    "XOAuth",
]
```

Create `backend/app/services/oauth/base.py`:
```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass
class OAuthTokens:
    access_token: str
    refresh_token: str | None
    expires_at: datetime | None
    token_type: str = "Bearer"
    raw_response: dict | None = None


@dataclass
class OAuthUserInfo:
    platform_user_id: str
    username: str | None
    display_name: str | None
    avatar_url: str | None
    extra: dict | None = None


class BaseOAuthClient(ABC):
    @abstractmethod
    def get_authorization_url(self, state: str, code_challenge: str | None = None) -> str:
        """Build the platform-specific authorization URL."""
        ...

    @abstractmethod
    async def exchange_code(self, code: str, code_verifier: str | None = None) -> OAuthTokens:
        """Exchange authorization code for access/refresh tokens."""
        ...

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        """Use refresh token to obtain new access token."""
        ...

    @abstractmethod
    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        """Fetch user profile from platform API."""
        ...

    @abstractmethod
    async def revoke_token(self, access_token: str) -> bool:
        """Revoke the OAuth token."""
        ...
```

Create `backend/app/services/oauth/youtube.py`:
```python
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.services.oauth.base import BaseOAuthClient, OAuthTokens, OAuthUserInfo


class YouTubeOAuth(BaseOAuthClient):
    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/youtube/v3/channels"
    REVOKE_URL = "https://oauth2.googleapis.com/revoke"
    SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl"

    def get_authorization_url(self, state: str, code_challenge: str | None = None) -> str:
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state,
            "access_type": "offline",
            "prompt": "consent",  # Force consent to always get refresh_token
        }
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, code_verifier: str | None = None) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                },
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=refresh_token,  # Google doesn't rotate refresh tokens
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        channel = data["items"][0]
        snippet = channel["snippet"]
        return OAuthUserInfo(
            platform_user_id=channel["id"],
            username=snippet.get("customUrl", "").lstrip("@"),
            display_name=snippet["title"],
            avatar_url=snippet["thumbnails"]["default"]["url"],
        )

    async def revoke_token(self, access_token: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.REVOKE_URL,
                params={"token": access_token},
            )
            return response.status_code == 200
```

Create `backend/app/services/oauth/tiktok.py`:
```python
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.services.oauth.base import BaseOAuthClient, OAuthTokens, OAuthUserInfo


class TikTokOAuth(BaseOAuthClient):
    AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
    TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
    USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/"
    REVOKE_URL = "https://open.tiktokapis.com/v2/oauth/revoke/"
    SCOPES = "user.info.basic,video.publish,video.upload,video.list"

    def get_authorization_url(self, state: str, code_challenge: str | None = None) -> str:
        params = {
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "redirect_uri": settings.TIKTOK_REDIRECT_URI,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state,
        }
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, code_verifier: str | None = None) -> OAuthTokens:
        payload = {
            "client_key": settings.TIKTOK_CLIENT_KEY,
            "client_secret": settings.TIKTOK_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.TIKTOK_REDIRECT_URI,
        }
        if code_verifier:
            payload["code_verifier"] = code_verifier

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_key": settings.TIKTOK_CLIENT_KEY,
                    "client_secret": settings.TIKTOK_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", refresh_token),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                params={"fields": "open_id,display_name,avatar_url,username"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()["data"]["user"]

        return OAuthUserInfo(
            platform_user_id=data["open_id"],
            username=data.get("username"),
            display_name=data.get("display_name"),
            avatar_url=data.get("avatar_url"),
        )

    async def revoke_token(self, access_token: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.REVOKE_URL,
                data={
                    "client_key": settings.TIKTOK_CLIENT_KEY,
                    "token": access_token,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            return response.status_code == 200
```

Create `backend/app/services/oauth/instagram.py`:
```python
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.services.oauth.base import BaseOAuthClient, OAuthTokens, OAuthUserInfo


class InstagramOAuth(BaseOAuthClient):
    """Instagram via Facebook Graph API (Business/Creator accounts only)."""

    AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth"
    TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token"
    LONG_LIVED_TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token"
    GRAPH_URL = "https://graph.facebook.com/v21.0"
    SCOPES = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement"

    def get_authorization_url(self, state: str, code_challenge: str | None = None) -> str:
        params = {
            "client_id": settings.FACEBOOK_APP_ID,
            "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state,
        }
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, code_verifier: str | None = None) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            # Step 1: Exchange code for short-lived token
            response = await client.get(
                self.TOKEN_URL,
                params={
                    "client_id": settings.FACEBOOK_APP_ID,
                    "client_secret": settings.FACEBOOK_APP_SECRET,
                    "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
                    "code": code,
                },
            )
            response.raise_for_status()
            short_lived = response.json()

            # Step 2: Exchange short-lived token for long-lived token
            response = await client.get(
                self.LONG_LIVED_TOKEN_URL,
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.FACEBOOK_APP_ID,
                    "client_secret": settings.FACEBOOK_APP_SECRET,
                    "fb_exchange_token": short_lived["access_token"],
                },
            )
            response.raise_for_status()
            long_lived = response.json()

        return OAuthTokens(
            access_token=long_lived["access_token"],
            refresh_token=None,  # Facebook long-lived tokens don't have refresh tokens
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=long_lived.get("expires_in", 5184000)),
            raw_response=long_lived,
        )

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        # For Facebook long-lived tokens, refresh by exchanging the current token
        # This only works if the token hasn't expired yet
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.LONG_LIVED_TOKEN_URL,
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.FACEBOOK_APP_ID,
                    "client_secret": settings.FACEBOOK_APP_SECRET,
                    "fb_exchange_token": refresh_token,  # Pass current token as exchange token
                },
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=None,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 5184000)),
            raw_response=data,
        )

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            # Get pages the user manages
            pages_response = await client.get(
                f"{self.GRAPH_URL}/me/accounts",
                params={"access_token": access_token},
            )
            pages_response.raise_for_status()
            pages = pages_response.json()["data"]

            if not pages:
                raise ValueError("No Facebook Pages found. Instagram Business account requires a linked Facebook Page.")

            # Get Instagram Business Account ID from first page
            page = pages[0]
            ig_response = await client.get(
                f"{self.GRAPH_URL}/{page['id']}",
                params={
                    "fields": "instagram_business_account",
                    "access_token": access_token,
                },
            )
            ig_response.raise_for_status()
            ig_data = ig_response.json()

            if "instagram_business_account" not in ig_data:
                raise ValueError("No Instagram Business account linked to this Facebook Page.")

            ig_account_id = ig_data["instagram_business_account"]["id"]

            # Get Instagram profile info
            profile_response = await client.get(
                f"{self.GRAPH_URL}/{ig_account_id}",
                params={
                    "fields": "username,name,profile_picture_url",
                    "access_token": access_token,
                },
            )
            profile_response.raise_for_status()
            profile = profile_response.json()

        return OAuthUserInfo(
            platform_user_id=ig_account_id,
            username=profile.get("username"),
            display_name=profile.get("name"),
            avatar_url=profile.get("profile_picture_url"),
            extra={
                "facebook_page_id": page["id"],
                "facebook_page_name": page["name"],
                "facebook_page_token": page["access_token"],
            },
        )

    async def revoke_token(self, access_token: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.GRAPH_URL}/me/permissions",
                params={"access_token": access_token},
            )
            return response.status_code == 200
```

Create `backend/app/services/oauth/facebook.py`:
```python
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.services.oauth.base import BaseOAuthClient, OAuthTokens, OAuthUserInfo


class FacebookOAuth(BaseOAuthClient):
    AUTH_URL = "https://www.facebook.com/v21.0/dialog/oauth"
    TOKEN_URL = "https://graph.facebook.com/v21.0/oauth/access_token"
    GRAPH_URL = "https://graph.facebook.com/v21.0"
    SCOPES = "pages_manage_posts,pages_read_engagement,pages_show_list"

    def get_authorization_url(self, state: str, code_challenge: str | None = None) -> str:
        params = {
            "client_id": settings.FACEBOOK_APP_ID,
            "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state,
        }
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, code_verifier: str | None = None) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.TOKEN_URL,
                params={
                    "client_id": settings.FACEBOOK_APP_ID,
                    "client_secret": settings.FACEBOOK_APP_SECRET,
                    "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
                    "code": code,
                },
            )
            response.raise_for_status()
            short_lived = response.json()

            # Exchange for long-lived token
            response = await client.get(
                self.TOKEN_URL,
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.FACEBOOK_APP_ID,
                    "client_secret": settings.FACEBOOK_APP_SECRET,
                    "fb_exchange_token": short_lived["access_token"],
                },
            )
            response.raise_for_status()
            long_lived = response.json()

        return OAuthTokens(
            access_token=long_lived["access_token"],
            refresh_token=None,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=long_lived.get("expires_in", 5184000)),
            raw_response=long_lived,
        )

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.TOKEN_URL,
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": settings.FACEBOOK_APP_ID,
                    "client_secret": settings.FACEBOOK_APP_SECRET,
                    "fb_exchange_token": refresh_token,
                },
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=None,
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 5184000)),
            raw_response=data,
        )

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            # Get user's pages
            response = await client.get(
                f"{self.GRAPH_URL}/me/accounts",
                params={"access_token": access_token, "fields": "id,name,picture"},
            )
            response.raise_for_status()
            pages = response.json()["data"]

            if not pages:
                raise ValueError("No Facebook Pages found for this account.")

            page = pages[0]

        return OAuthUserInfo(
            platform_user_id=page["id"],
            username=None,
            display_name=page["name"],
            avatar_url=page.get("picture", {}).get("data", {}).get("url"),
            extra={
                "page_id": page["id"],
                "page_name": page["name"],
                "page_access_token": page.get("access_token"),
                "all_pages": [{"id": p["id"], "name": p["name"]} for p in pages],
            },
        )

    async def revoke_token(self, access_token: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.GRAPH_URL}/me/permissions",
                params={"access_token": access_token},
            )
            return response.status_code == 200
```

Create `backend/app/services/oauth/linkedin.py`:
```python
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.services.oauth.base import BaseOAuthClient, OAuthTokens, OAuthUserInfo


class LinkedInOAuth(BaseOAuthClient):
    AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
    TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
    USERINFO_URL = "https://api.linkedin.com/v2/userinfo"
    SCOPES = "openid profile w_member_social"

    def get_authorization_url(self, state: str, code_challenge: str | None = None) -> str:
        params = {
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state,
        }
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, code_verifier: str | None = None) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.LINKEDIN_CLIENT_ID,
                    "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.LINKEDIN_CLIENT_ID,
                    "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", refresh_token),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        return OAuthUserInfo(
            platform_user_id=data["sub"],
            username=None,
            display_name=data.get("name"),
            avatar_url=data.get("picture"),
        )

    async def revoke_token(self, access_token: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://www.linkedin.com/oauth/v2/revoke",
                data={
                    "client_id": settings.LINKEDIN_CLIENT_ID,
                    "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                    "token": access_token,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            return response.status_code == 200
```

Create `backend/app/services/oauth/x.py`:
```python
import base64
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.services.oauth.base import BaseOAuthClient, OAuthTokens, OAuthUserInfo


class XOAuth(BaseOAuthClient):
    """X (Twitter) OAuth 2.0 with PKCE."""

    AUTH_URL = "https://twitter.com/i/oauth2/authorize"
    TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
    USERINFO_URL = "https://api.twitter.com/2/users/me"
    REVOKE_URL = "https://api.twitter.com/2/oauth2/revoke"
    SCOPES = "tweet.read tweet.write users.read offline.access"

    def _get_basic_auth(self) -> str:
        credentials = f"{settings.X_CLIENT_ID}:{settings.X_CLIENT_SECRET}"
        return base64.b64encode(credentials.encode()).decode()

    def get_authorization_url(self, state: str, code_challenge: str | None = None) -> str:
        params = {
            "client_id": settings.X_CLIENT_ID,
            "redirect_uri": settings.X_REDIRECT_URI,
            "response_type": "code",
            "scope": self.SCOPES,
            "state": state,
            "code_challenge_method": "S256",
        }
        if code_challenge:
            params["code_challenge"] = code_challenge
        return f"{self.AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, code_verifier: str | None = None) -> OAuthTokens:
        payload = {
            "client_id": settings.X_CLIENT_ID,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.X_REDIRECT_URI,
        }
        if code_verifier:
            payload["code_verifier"] = code_verifier

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data=payload,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {self._get_basic_auth()}",
                },
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token"),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def refresh_access_token(self, refresh_token: str) -> OAuthTokens:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": settings.X_CLIENT_ID,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {self._get_basic_auth()}",
                },
            )
            response.raise_for_status()
            data = response.json()

        return OAuthTokens(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", refresh_token),
            expires_at=datetime.now(timezone.utc) + timedelta(seconds=data["expires_in"]),
            raw_response=data,
        )

    async def get_user_info(self, access_token: str) -> OAuthUserInfo:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USERINFO_URL,
                params={"user.fields": "id,name,username,profile_image_url"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()["data"]

        return OAuthUserInfo(
            platform_user_id=data["id"],
            username=data.get("username"),
            display_name=data.get("name"),
            avatar_url=data.get("profile_image_url"),
        )

    async def revoke_token(self, access_token: str) -> bool:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.REVOKE_URL,
                data={
                    "client_id": settings.X_CLIENT_ID,
                    "token": access_token,
                    "token_type_hint": "access_token",
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {self._get_basic_auth()}",
                },
            )
            return response.status_code == 200
```

### Step 8: Create Social Account Service

Create `backend/app/services/social_account_service.py`:
```python
import uuid
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social_account import Platform, SocialAccount
from app.services.oauth.base import BaseOAuthClient, OAuthTokens, OAuthUserInfo
from app.services.oauth import (
    YouTubeOAuth, TikTokOAuth, InstagramOAuth,
    FacebookOAuth, LinkedInOAuth, XOAuth,
)
from app.services.token_encryption import token_encryption

logger = structlog.get_logger()

OAUTH_CLIENTS: dict[Platform, BaseOAuthClient] = {
    Platform.YOUTUBE: YouTubeOAuth(),
    Platform.TIKTOK: TikTokOAuth(),
    Platform.INSTAGRAM: InstagramOAuth(),
    Platform.FACEBOOK: FacebookOAuth(),
    Platform.LINKEDIN: LinkedInOAuth(),
    Platform.X: XOAuth(),
}


class SocialAccountService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def get_oauth_client(self, platform: Platform) -> BaseOAuthClient:
        client = OAUTH_CLIENTS.get(platform)
        if not client:
            raise ValueError(f"Unsupported platform: {platform}")
        return client

    async def save_account(
        self,
        user_id: uuid.UUID,
        platform: Platform,
        tokens: OAuthTokens,
        user_info: OAuthUserInfo,
    ) -> SocialAccount:
        """Save or update a connected social account."""
        # Check if account already exists
        result = await self.db.execute(
            select(SocialAccount).where(
                SocialAccount.user_id == user_id,
                SocialAccount.platform == platform,
                SocialAccount.platform_user_id == user_info.platform_user_id,
            )
        )
        account = result.scalar_one_or_none()

        if account:
            # Update existing
            account.access_token_encrypted = token_encryption.encrypt(tokens.access_token)
            if tokens.refresh_token:
                account.refresh_token_encrypted = token_encryption.encrypt(tokens.refresh_token)
            account.token_expires_at = tokens.expires_at
            account.platform_username = user_info.username
            account.platform_display_name = user_info.display_name
            account.platform_avatar_url = user_info.avatar_url
            account.is_active = True
            account.disconnected_reason = None
        else:
            # Create new
            account = SocialAccount(
                user_id=user_id,
                platform=platform,
                platform_user_id=user_info.platform_user_id,
                platform_username=user_info.username,
                platform_display_name=user_info.display_name,
                platform_avatar_url=user_info.avatar_url,
                access_token_encrypted=token_encryption.encrypt(tokens.access_token),
                refresh_token_encrypted=(
                    token_encryption.encrypt(tokens.refresh_token)
                    if tokens.refresh_token else None
                ),
                token_expires_at=tokens.expires_at,
                is_active=True,
            )
            # Handle page-specific data (Facebook/Instagram)
            if user_info.extra:
                if "facebook_page_id" in user_info.extra:
                    account.page_id = user_info.extra["facebook_page_id"]
                    account.page_name = user_info.extra["facebook_page_name"]
                    if user_info.extra.get("facebook_page_token"):
                        account.page_access_token_encrypted = token_encryption.encrypt(
                            user_info.extra["facebook_page_token"]
                        )
                elif "page_id" in user_info.extra:
                    account.page_id = user_info.extra["page_id"]
                    account.page_name = user_info.extra["page_name"]
                    if user_info.extra.get("page_access_token"):
                        account.page_access_token_encrypted = token_encryption.encrypt(
                            user_info.extra["page_access_token"]
                        )
            self.db.add(account)

        await self.db.commit()
        await self.db.refresh(account)
        return account

    async def get_valid_token(self, account: SocialAccount) -> str:
        """Get a valid access token, refreshing if needed."""
        if account.token_expires_at and account.token_expires_at < datetime.now(timezone.utc) + timedelta(minutes=5):
            # Token expires soon, refresh it
            oauth_client = self.get_oauth_client(account.platform)
            if account.refresh_token_encrypted:
                try:
                    refresh_token = token_encryption.decrypt(account.refresh_token_encrypted)
                    new_tokens = await oauth_client.refresh_access_token(refresh_token)
                    account.access_token_encrypted = token_encryption.encrypt(new_tokens.access_token)
                    if new_tokens.refresh_token:
                        account.refresh_token_encrypted = token_encryption.encrypt(new_tokens.refresh_token)
                    account.token_expires_at = new_tokens.expires_at
                    await self.db.commit()
                    return new_tokens.access_token
                except Exception as e:
                    logger.error("token_refresh_failed", platform=account.platform, error=str(e))
                    account.is_active = False
                    account.disconnected_reason = f"Token refresh failed: {str(e)}"
                    await self.db.commit()
                    raise
            else:
                # No refresh token — mark as disconnected
                account.is_active = False
                account.disconnected_reason = "Token expired and no refresh token available"
                await self.db.commit()
                raise ValueError("Token expired, re-authentication required")

        return token_encryption.decrypt(account.access_token_encrypted)

    async def list_accounts(self, user_id: uuid.UUID) -> list[SocialAccount]:
        result = await self.db.execute(
            select(SocialAccount).where(SocialAccount.user_id == user_id)
        )
        return list(result.scalars().all())

    async def disconnect_account(self, user_id: uuid.UUID, account_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(SocialAccount).where(
                SocialAccount.id == account_id,
                SocialAccount.user_id == user_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            return False

        # Revoke token on platform
        oauth_client = self.get_oauth_client(account.platform)
        try:
            access_token = token_encryption.decrypt(account.access_token_encrypted)
            await oauth_client.revoke_token(access_token)
        except Exception as e:
            logger.warning("token_revoke_failed", error=str(e))

        await self.db.delete(account)
        await self.db.commit()
        return True
```

### Step 9: Create OAuth API Routes

Create `backend/app/api/v1/oauth.py`:
```python
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.social_account import Platform
from app.models.user import User
from app.services.oauth_state import oauth_state_manager
from app.services.social_account_service import SocialAccountService

router = APIRouter(prefix="/oauth", tags=["oauth"])

# Platforms that require PKCE
PKCE_PLATFORMS = {Platform.X, Platform.TIKTOK}

# HTML response that sends postMessage to parent window and closes popup
CALLBACK_HTML = """
<!DOCTYPE html>
<html>
<head><title>OpenClip - Connecting...</title></head>
<body>
<script>
  window.opener.postMessage({{
    type: "oauth_callback",
    platform: "{platform}",
    success: {success},
    error: "{error}"
  }}, "{frontend_url}");
  window.close();
</script>
<p>Connecting your account... This window should close automatically.</p>
</body>
</html>
"""


@router.get("/{platform}/authorize")
async def authorize(
    platform: Platform,
    user: User = Depends(get_current_user),
):
    """Generate OAuth authorization URL for the given platform."""
    service = SocialAccountService(None)  # No DB needed for URL generation
    oauth_client = service.get_oauth_client(platform)

    state_data = await oauth_state_manager.create_state(
        user_id=str(user.id),
        platform=platform.value,
    )

    code_challenge = state_data["code_challenge"] if platform in PKCE_PLATFORMS else None
    auth_url = oauth_client.get_authorization_url(
        state=state_data["state"],
        code_challenge=code_challenge,
    )

    return {"authorization_url": auth_url}


@router.get("/{platform}/callback", response_class=HTMLResponse)
async def callback(
    platform: Platform,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth callback from platform. Returns HTML that communicates with parent window."""
    # Validate state
    state_data = await oauth_state_manager.validate_state(state)
    if not state_data:
        return HTMLResponse(
            CALLBACK_HTML.format(
                platform=platform.value,
                success="false",
                error="Invalid or expired OAuth state. Please try again.",
                frontend_url=settings.FRONTEND_URL,
            )
        )

    if state_data["platform"] != platform.value:
        return HTMLResponse(
            CALLBACK_HTML.format(
                platform=platform.value,
                success="false",
                error="Platform mismatch in OAuth state.",
                frontend_url=settings.FRONTEND_URL,
            )
        )

    user_id = uuid.UUID(state_data["user_id"])

    try:
        service = SocialAccountService(db)
        oauth_client = service.get_oauth_client(platform)

        # Exchange code for tokens
        code_verifier = state_data.get("code_verifier") if platform in PKCE_PLATFORMS else None
        tokens = await oauth_client.exchange_code(code, code_verifier=code_verifier)

        # Fetch user profile from platform
        user_info = await oauth_client.get_user_info(tokens.access_token)

        # Save to database
        await service.save_account(user_id, platform, tokens, user_info)

        return HTMLResponse(
            CALLBACK_HTML.format(
                platform=platform.value,
                success="true",
                error="",
                frontend_url=settings.FRONTEND_URL,
            )
        )

    except Exception as e:
        return HTMLResponse(
            CALLBACK_HTML.format(
                platform=platform.value,
                success="false",
                error=str(e).replace('"', '\\"'),
                frontend_url=settings.FRONTEND_URL,
            )
        )


@router.get("/accounts")
async def list_accounts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all connected social accounts for the current user."""
    service = SocialAccountService(db)
    accounts = await service.list_accounts(user.id)
    return [
        {
            "id": str(a.id),
            "platform": a.platform.value,
            "platform_username": a.platform_username,
            "platform_display_name": a.platform_display_name,
            "platform_avatar_url": a.platform_avatar_url,
            "is_active": a.is_active,
            "disconnected_reason": a.disconnected_reason,
            "connected_at": a.created_at.isoformat(),
        }
        for a in accounts
    ]


@router.delete("/accounts/{account_id}")
async def disconnect_account(
    account_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect (revoke and delete) a social account."""
    service = SocialAccountService(db)
    success = await service.disconnect_account(user.id, account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"status": "disconnected"}
```

### Step 10: Create Token Refresh Celery Task

Create `backend/app/tasks/oauth.py`:
```python
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_sync_session
from app.models.social_account import SocialAccount
from app.services.token_encryption import token_encryption
from app.services.social_account_service import OAUTH_CLIENTS
from app.worker import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.oauth.refresh_expiring_tokens")
def refresh_expiring_tokens():
    """Refresh all tokens expiring within the next hour. Runs via Celery Beat."""
    threshold = datetime.now(timezone.utc) + timedelta(hours=1)

    with get_sync_session() as db:
        result = db.execute(
            select(SocialAccount).where(
                SocialAccount.is_active.is_(True),
                SocialAccount.token_expires_at.isnot(None),
                SocialAccount.token_expires_at < threshold,
                SocialAccount.refresh_token_encrypted.isnot(None),
            )
        )
        accounts = result.scalars().all()

        for account in accounts:
            try:
                oauth_client = OAUTH_CLIENTS[account.platform]
                refresh_token = token_encryption.decrypt(account.refresh_token_encrypted)

                import asyncio
                new_tokens = asyncio.run(oauth_client.refresh_access_token(refresh_token))

                account.access_token_encrypted = token_encryption.encrypt(new_tokens.access_token)
                if new_tokens.refresh_token:
                    account.refresh_token_encrypted = token_encryption.encrypt(new_tokens.refresh_token)
                account.token_expires_at = new_tokens.expires_at

                logger.info(
                    "token_refreshed",
                    platform=account.platform.value,
                    account_id=str(account.id),
                )
            except Exception as e:
                logger.error(
                    "token_refresh_failed",
                    platform=account.platform.value,
                    account_id=str(account.id),
                    error=str(e),
                )
                account.is_active = False
                account.disconnected_reason = f"Auto-refresh failed: {str(e)}"

        db.commit()
```

Add to Celery Beat schedule in `backend/app/worker.py`:
```python
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "refresh-expiring-tokens": {
        "task": "app.tasks.oauth.refresh_expiring_tokens",
        "schedule": crontab(minute="*/30"),  # Every 30 minutes
    },
}
```

### Step 11: Frontend OAuth Popup Component

Create `frontend/src/lib/oauth.ts`:
```typescript
const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;

export type Platform = "youtube" | "tiktok" | "instagram" | "facebook" | "linkedin" | "x";

interface OAuthCallbackMessage {
  type: "oauth_callback";
  platform: Platform;
  success: boolean;
  error: string;
}

export async function connectPlatform(
  platform: Platform,
  accessToken: string,
): Promise<{ success: boolean; error?: string }> {
  // Step 1: Get authorization URL from backend
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/oauth/${platform}/authorize`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to get authorization URL");
  }

  const { authorization_url } = await response.json();

  // Step 2: Open popup
  const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
  const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;

  const popup = window.open(
    authorization_url,
    `oauth_${platform}`,
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes`,
  );

  if (!popup) {
    throw new Error("Popup blocked. Please allow popups for this site.");
  }

  // Step 3: Listen for postMessage from callback
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error("OAuth timeout — popup was closed or took too long"));
    }, 300000); // 5 minute timeout

    function handler(event: MessageEvent<OAuthCallbackMessage>) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "oauth_callback") return;
      if (event.data.platform !== platform) return;

      clearTimeout(timeout);
      window.removeEventListener("message", handler);

      if (event.data.success) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: event.data.error });
      }
    }

    window.addEventListener("message", handler);

    // Also check if popup was closed manually
    const pollClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollClosed);
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        resolve({ success: false, error: "Popup was closed" });
      }
    }, 500);
  });
}
```

Create `frontend/src/components/social/connect-account-button.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { connectPlatform, Platform } from "@/lib/oauth";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string }> = {
  youtube: { label: "YouTube", icon: "youtube", color: "bg-red-600 hover:bg-red-700" },
  tiktok: { label: "TikTok", icon: "tiktok", color: "bg-black hover:bg-gray-900" },
  instagram: { label: "Instagram", icon: "instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600" },
  facebook: { label: "Facebook", icon: "facebook", color: "bg-blue-600 hover:bg-blue-700" },
  linkedin: { label: "LinkedIn", icon: "linkedin", color: "bg-blue-700 hover:bg-blue-800" },
  x: { label: "X (Twitter)", icon: "x", color: "bg-black hover:bg-gray-900" },
};

interface ConnectAccountButtonProps {
  platform: Platform;
  onConnected?: () => void;
}

export function ConnectAccountButton({ platform, onConnected }: ConnectAccountButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { accessToken } = useAuth();
  const config = PLATFORM_CONFIG[platform];

  const handleConnect = async () => {
    if (!accessToken) {
      toast.error("Please sign in first");
      return;
    }

    setIsConnecting(true);
    try {
      const result = await connectPlatform(platform, accessToken);
      if (result.success) {
        toast.success(`${config.label} connected successfully!`);
        onConnected?.();
      } else {
        toast.error(`Failed to connect ${config.label}: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      className={`${config.color} text-white`}
    >
      {isConnecting ? "Connecting..." : `Connect ${config.label}`}
    </Button>
  );
}
```

Create `frontend/src/components/social/connected-accounts.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectAccountButton } from "@/components/social/connect-account-button";
import { useAuth } from "@/hooks/use-auth";
import { Platform } from "@/lib/oauth";
import { toast } from "sonner";

interface SocialAccount {
  id: string;
  platform: Platform;
  platform_username: string | null;
  platform_display_name: string | null;
  platform_avatar_url: string | null;
  is_active: boolean;
  disconnected_reason: string | null;
  connected_at: string;
}

const ALL_PLATFORMS: Platform[] = ["youtube", "tiktok", "instagram", "facebook", "linkedin", "x"];

export function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { accessToken } = useAuth();

  const fetchAccounts = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/oauth/accounts`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (response.ok) {
        setAccounts(await response.json());
      }
    } catch (error) {
      console.error("Failed to fetch accounts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [accessToken]);

  const handleDisconnect = async (accountId: string, platform: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/oauth/accounts/${accountId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (response.ok) {
        toast.success(`${platform} disconnected`);
        fetchAccounts();
      }
    } catch (error) {
      toast.error("Failed to disconnect account");
    }
  };

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));
  const unconnectedPlatforms = ALL_PLATFORMS.filter((p) => !connectedPlatforms.has(p));

  if (loading) return <div>Loading accounts...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 && <p className="text-muted-foreground">No accounts connected yet.</p>}
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {account.platform_avatar_url && (
                  <img src={account.platform_avatar_url} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div>
                  <p className="font-medium">
                    {account.platform_display_name || account.platform_username}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">{account.platform}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {account.is_active ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="destructive" title={account.disconnected_reason || ""}>
                    Disconnected
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={() => handleDisconnect(account.id, account.platform)}>
                  Disconnect
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {unconnectedPlatforms.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connect More Platforms</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {unconnectedPlatforms.map((platform) => (
              <ConnectAccountButton key={platform} platform={platform} onConnected={fetchAccounts} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

## Best Practices
- **Encrypt tokens at rest:** Never store OAuth tokens in plaintext. Use Fernet (AES-128-CBC + HMAC-SHA256).
- **State parameter:** Always validate the state parameter to prevent CSRF attacks. Use one-time tokens stored in Redis with TTL.
- **PKCE:** Use PKCE (S256) for platforms that support it (X requires it). Adds security even for confidential clients.
- **Prompt consent:** For Google, use `prompt=consent` to ensure refresh_token is always returned.
- **Token rotation:** Some platforms rotate refresh tokens on each use (X, TikTok). Always store the latest.
- **Graceful degradation:** When token refresh fails, mark account as inactive and surface the error to the user.
- **Secrets management:** Store client secrets in environment variables, never in code.

## Testing
- **Unit tests:** Mock httpx calls to test each OAuth client's URL generation, token exchange, and error handling.
- **Integration test:** Start backend, visit `/api/v1/oauth/youtube/authorize` manually, complete flow with a test Google account.
- **Token refresh test:** Manually expire a token in the database and verify the refresh task picks it up.
- **State validation test:** Attempt callback with invalid/expired state token and verify rejection.

```python
# backend/tests/test_oauth.py
import pytest
from unittest.mock import AsyncMock, patch
from app.services.oauth.youtube import YouTubeOAuth
from app.services.token_encryption import TokenEncryption


class TestYouTubeOAuth:
    def test_authorization_url_contains_required_params(self):
        client = YouTubeOAuth()
        url = client.get_authorization_url(state="test-state")
        assert "client_id=" in url
        assert "state=test-state" in url
        assert "access_type=offline" in url
        assert "prompt=consent" in url

    @pytest.mark.asyncio
    async def test_exchange_code(self):
        client = YouTubeOAuth()
        mock_response = AsyncMock()
        mock_response.json.return_value = {
            "access_token": "ya29.test",
            "refresh_token": "1//test",
            "expires_in": 3600,
            "token_type": "Bearer",
        }
        mock_response.raise_for_status = lambda: None

        with patch("httpx.AsyncClient.post", return_value=mock_response):
            tokens = await client.exchange_code("auth-code-123")
            assert tokens.access_token == "ya29.test"
            assert tokens.refresh_token == "1//test"


class TestTokenEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from cryptography.fernet import Fernet
        key = Fernet.generate_key().decode()
        with patch("app.services.token_encryption.settings") as mock_settings:
            mock_settings.TOKEN_ENCRYPTION_KEY = key
            enc = TokenEncryption()
            plaintext = "ya29.super-secret-token"
            ciphertext = enc.encrypt(plaintext)
            assert ciphertext != plaintext
            assert enc.decrypt(ciphertext) == plaintext
```

## Verification Checklist
- [ ] `social_accounts` table created with Alembic migration
- [ ] Token encryption service encrypts/decrypts correctly
- [ ] OAuth state tokens stored in Redis with 10-minute TTL
- [ ] YouTube OAuth: authorize URL generated, callback exchanges code, tokens stored
- [ ] TikTok OAuth: uses `client_key`, PKCE flow works
- [ ] Instagram OAuth: short-lived token exchanged for long-lived, page token saved
- [ ] Facebook OAuth: page access tokens retrieved and stored
- [ ] LinkedIn OAuth: token exchange and user info retrieval works
- [ ] X OAuth: PKCE code_challenge/code_verifier flow works
- [ ] Frontend popup opens, completes flow, closes, and parent refreshes
- [ ] Token refresh Celery Beat task runs every 30 minutes
- [ ] Expired tokens trigger re-authentication prompt
- [ ] Account disconnect revokes token on platform and deletes from database
- [ ] All tokens encrypted at rest in PostgreSQL
- [ ] State parameter validated on every callback (CSRF protection)
