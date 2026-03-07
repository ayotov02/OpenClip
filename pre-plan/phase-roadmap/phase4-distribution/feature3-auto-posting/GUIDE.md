# Auto-Posting Engine — Implementation Guide

## Overview
- **What:** Automatically publish scheduled posts to connected social platforms (YouTube, TikTok, Instagram, Facebook, LinkedIn, X) at the scheduled time. Includes AI-generated platform-specific titles, descriptions, and hashtags via Qwen3, queue-based publishing with retry logic, and per-platform status tracking.
- **Why:** Manual publishing across 6 platforms is tedious and error-prone. Auto-posting is the core value of the distribution layer — schedule once, publish everywhere. AI-generated metadata ensures each platform gets optimized content (YouTube needs SEO descriptions, TikTok needs trending hashtags, X needs concise text).
- **Dependencies:** Phase 4 Feature 1 (Social OAuth), Phase 4 Feature 2 (Content Calendar), Phase 1 Feature 3 (Celery + Redis job queue), Phase 1 Feature 6 (LLM Integration via Ollama/Qwen3).

## Architecture

### System Design
```
Celery Beat (every minute)
  │
  │  check_due_posts task
  ▼
┌─────────────────────────┐
│ Query scheduled_posts    │
│ WHERE status=scheduled   │
│ AND scheduled_at <= now  │
└───────────┬─────────────┘
            │ For each post:
            ▼
┌─────────────────────────┐     ┌──────────────────┐
│ Dispatch publish task   │────>│ Celery: publish   │
│ to 'publish' queue      │     │ queue (concur=4)  │
└─────────────────────────┘     └────────┬─────────┘
                                         │
                              ┌──────────┼──────────┐
                              ▼          ▼          ▼
                         YouTube     TikTok    Instagram
                         Data API    Content   Graph API
                         v3          Posting
                                     API
                              │          │          │
                              ▼          ▼          ▼
                         Update scheduled_post status:
                         published / failed + error_message
                              │
                              ▼
                         Fire webhook: video.published / video.publish_failed
```

### Publishing Flow Per Platform
```
1. Load ScheduledPost + SocialAccount from DB
2. Get valid access token (refresh if needed)
3. If title/description empty → generate with AI (Qwen3 via Ollama)
4. Upload video file to platform
5. Set metadata (title, description, tags, thumbnail, visibility)
6. Poll for processing status (YouTube, TikTok)
7. Update ScheduledPost: status=published, platform_post_id, platform_post_url
8. On failure: retry up to 3 times with exponential backoff
9. After max retries: status=failed, error_message stored
```

## Step-by-Step Implementation

### Step 1: Install Dependencies

Add to `backend/requirements.txt`:
```
google-api-python-client>=2.150.0
google-auth>=2.36.0
google-auth-httplib2>=0.2.0
```

### Step 2: AI Content Generation Service

Create `backend/app/services/ai_content_generator.py`:
```python
import json
import structlog
import httpx

from app.core.config import settings

logger = structlog.get_logger()

PLATFORM_PROMPTS = {
    "youtube": """Generate a YouTube video title, description, and tags for the following video content.
Requirements:
- Title: 60-70 characters, attention-grabbing, include main keyword
- Description: 200-500 words, include timestamps if possible, 3-5 relevant links/CTAs, keywords naturally integrated
- Tags: 10-15 tags, mix of broad and specific, comma-separated

Video content summary: {content_summary}
Video transcript excerpt: {transcript_excerpt}

Respond in JSON format:
{{"title": "...", "description": "...", "tags": ["tag1", "tag2", ...]}}""",

    "tiktok": """Generate a TikTok video caption and hashtags for the following video content.
Requirements:
- Caption: 150 characters max, hook in first line, include CTA
- Hashtags: 5-8 hashtags, mix of trending and niche, include #fyp

Video content summary: {content_summary}

Respond in JSON format:
{{"caption": "...", "hashtags": ["#hashtag1", "#hashtag2", ...]}}""",

    "instagram": """Generate an Instagram Reel caption and hashtags for the following video content.
Requirements:
- Caption: 150-300 characters, engaging hook, include CTA
- Hashtags: 20-30 hashtags, mix of popular (1M+), medium (100K-1M), and niche (<100K)

Video content summary: {content_summary}

Respond in JSON format:
{{"caption": "...", "hashtags": ["#hashtag1", "#hashtag2", ...]}}""",

    "facebook": """Generate a Facebook post text for the following video content.
Requirements:
- Text: 100-250 characters, conversational tone, include question or CTA
- No hashtags (they reduce reach on Facebook)

Video content summary: {content_summary}

Respond in JSON format:
{{"text": "..."}}""",

    "linkedin": """Generate a LinkedIn post text for the following video content.
Requirements:
- Text: 200-400 characters, professional tone, include insight or takeaway
- Hashtags: 3-5 relevant professional hashtags

Video content summary: {content_summary}

Respond in JSON format:
{{"text": "...", "hashtags": ["#hashtag1", "#hashtag2", ...]}}""",

    "x": """Generate a tweet (X post) for the following video content.
Requirements:
- Text: 200 characters max (leaving room for link), attention-grabbing hook
- Hashtags: 1-2 relevant hashtags only (less is more on X)

Video content summary: {content_summary}

Respond in JSON format:
{{"text": "...", "hashtags": ["#hashtag1"]}}""",
}


class AIContentGenerator:
    """Generate platform-specific titles, descriptions, and hashtags using Qwen3 via Ollama."""

    def __init__(self):
        self.ollama_url = settings.OLLAMA_URL
        self.model = "qwen3:14b"  # or qwen3:32b if GPU allows

    async def generate(
        self,
        platform: str,
        content_summary: str,
        transcript_excerpt: str = "",
    ) -> dict:
        """Generate platform-optimized metadata for a video post."""
        prompt_template = PLATFORM_PROMPTS.get(platform)
        if not prompt_template:
            return {}

        prompt = prompt_template.format(
            content_summary=content_summary,
            transcript_excerpt=transcript_excerpt[:1000],  # Limit to 1000 chars
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "top_p": 0.9,
                        },
                    },
                )
                response.raise_for_status()
                result = response.json()

            # Parse JSON from LLM response
            raw_text = result.get("response", "")
            # Extract JSON from possible markdown code blocks
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0]
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0]

            return json.loads(raw_text.strip())

        except (json.JSONDecodeError, httpx.HTTPError, KeyError) as e:
            logger.error("ai_content_generation_failed", platform=platform, error=str(e))
            return {}


ai_content_generator = AIContentGenerator()
```

### Step 3: Platform Publisher Base Class

Create `backend/app/services/publishers/__init__.py`:
```python
from app.services.publishers.youtube import YouTubePublisher
from app.services.publishers.tiktok import TikTokPublisher
from app.services.publishers.instagram import InstagramPublisher
from app.services.publishers.facebook import FacebookPublisher
from app.services.publishers.linkedin import LinkedInPublisher
from app.services.publishers.x import XPublisher

__all__ = [
    "YouTubePublisher",
    "TikTokPublisher",
    "InstagramPublisher",
    "FacebookPublisher",
    "LinkedInPublisher",
    "XPublisher",
]
```

Create `backend/app/services/publishers/base.py`:
```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PublishResult:
    success: bool
    platform_post_id: str | None = None
    platform_post_url: str | None = None
    error_message: str | None = None
    raw_response: dict | None = None


@dataclass
class PublishRequest:
    video_file_path: str  # Local path or GCS URL to the video file
    title: str
    description: str
    hashtags: list[str] | None = None
    thumbnail_path: str | None = None
    access_token: str = ""
    platform_metadata: dict | None = None  # Platform-specific options


class BasePublisher(ABC):
    @abstractmethod
    async def publish(self, request: PublishRequest) -> PublishResult:
        """Upload and publish video to the platform."""
        ...

    @abstractmethod
    async def check_status(self, platform_post_id: str, access_token: str) -> dict:
        """Check processing/publishing status for a video."""
        ...
```

### Step 4: YouTube Publisher

Create `backend/app/services/publishers/youtube.py`:
```python
import io
import os
import structlog

from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from google.oauth2.credentials import Credentials

from app.services.publishers.base import BasePublisher, PublishRequest, PublishResult

logger = structlog.get_logger()

# YouTube category IDs
CATEGORY_IDS = {
    "entertainment": "24",
    "education": "27",
    "howto": "26",
    "science": "28",
    "gaming": "20",
    "music": "10",
    "news": "25",
    "people": "22",
}


class YouTubePublisher(BasePublisher):
    async def publish(self, request: PublishRequest) -> PublishResult:
        try:
            credentials = Credentials(token=request.access_token)
            youtube = build("youtube", "v3", credentials=credentials)

            metadata = request.platform_metadata or {}
            category_id = metadata.get("category_id", "22")  # Default: People & Blogs
            privacy_status = metadata.get("privacy_status", "public")
            made_for_kids = metadata.get("made_for_kids", False)

            body = {
                "snippet": {
                    "title": request.title[:100],  # YouTube max 100 chars
                    "description": request.description[:5000],  # YouTube max 5000 chars
                    "tags": request.hashtags[:500] if request.hashtags else [],
                    "categoryId": category_id,
                },
                "status": {
                    "privacyStatus": privacy_status,
                    "selfDeclaredMadeForKids": made_for_kids,
                },
            }

            # Upload video
            media = MediaFileUpload(
                request.video_file_path,
                mimetype="video/mp4",
                resumable=True,
                chunksize=10 * 1024 * 1024,  # 10MB chunks
            )

            insert_request = youtube.videos().insert(
                part="snippet,status",
                body=body,
                media_body=media,
            )

            response = None
            while response is None:
                status, response = insert_request.next_chunk()
                if status:
                    logger.info("youtube_upload_progress", progress=f"{int(status.progress() * 100)}%")

            video_id = response["id"]

            # Upload thumbnail if provided
            if request.thumbnail_path and os.path.exists(request.thumbnail_path):
                thumbnail_media = MediaFileUpload(request.thumbnail_path, mimetype="image/jpeg")
                youtube.thumbnails().set(videoId=video_id, media_body=thumbnail_media).execute()

            return PublishResult(
                success=True,
                platform_post_id=video_id,
                platform_post_url=f"https://www.youtube.com/watch?v={video_id}",
                raw_response=response,
            )

        except Exception as e:
            logger.error("youtube_publish_failed", error=str(e))
            return PublishResult(success=False, error_message=str(e))

    async def check_status(self, platform_post_id: str, access_token: str) -> dict:
        credentials = Credentials(token=access_token)
        youtube = build("youtube", "v3", credentials=credentials)
        response = youtube.videos().list(part="status,processingDetails", id=platform_post_id).execute()
        if response["items"]:
            item = response["items"][0]
            return {
                "upload_status": item["status"].get("uploadStatus"),
                "privacy_status": item["status"].get("privacyStatus"),
                "processing": item.get("processingDetails", {}),
            }
        return {"error": "Video not found"}
```

### Step 5: TikTok Publisher

Create `backend/app/services/publishers/tiktok.py`:
```python
import os
import structlog
import httpx

from app.services.publishers.base import BasePublisher, PublishRequest, PublishResult

logger = structlog.get_logger()

TIKTOK_API_URL = "https://open.tiktokapis.com/v2"


class TikTokPublisher(BasePublisher):
    async def publish(self, request: PublishRequest) -> PublishResult:
        try:
            headers = {
                "Authorization": f"Bearer {request.access_token}",
                "Content-Type": "application/json",
            }

            # Step 1: Initialize upload
            file_size = os.path.getsize(request.video_file_path)
            metadata = request.platform_metadata or {}

            init_payload = {
                "post_info": {
                    "title": request.title[:150],
                    "privacy_level": metadata.get("privacy_level", "SELF_ONLY"),  # Start as private for safety
                    "disable_duet": metadata.get("disable_duet", False),
                    "disable_comment": metadata.get("disable_comment", False),
                    "disable_stitch": metadata.get("disable_stitch", False),
                    "video_cover_timestamp_ms": metadata.get("cover_timestamp_ms", 1000),
                },
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": file_size,
                    "chunk_size": min(file_size, 10 * 1024 * 1024),
                    "total_chunk_count": max(1, file_size // (10 * 1024 * 1024) + 1),
                },
            }

            async with httpx.AsyncClient(timeout=300.0) as client:
                # Initialize upload
                init_response = await client.post(
                    f"{TIKTOK_API_URL}/post/publish/inbox/video/init/",
                    json=init_payload,
                    headers=headers,
                )
                init_response.raise_for_status()
                init_data = init_response.json()

                if init_data.get("error", {}).get("code") != "ok":
                    return PublishResult(
                        success=False,
                        error_message=init_data.get("error", {}).get("message", "Init failed"),
                    )

                upload_url = init_data["data"]["upload_url"]
                publish_id = init_data["data"]["publish_id"]

                # Step 2: Upload video chunks
                with open(request.video_file_path, "rb") as f:
                    chunk_size = 10 * 1024 * 1024  # 10MB
                    chunk_index = 0
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        start_byte = chunk_index * chunk_size
                        end_byte = start_byte + len(chunk) - 1

                        upload_response = await client.put(
                            upload_url,
                            content=chunk,
                            headers={
                                "Content-Range": f"bytes {start_byte}-{end_byte}/{file_size}",
                                "Content-Type": "video/mp4",
                            },
                        )
                        upload_response.raise_for_status()
                        chunk_index += 1

                logger.info("tiktok_upload_complete", publish_id=publish_id)

                return PublishResult(
                    success=True,
                    platform_post_id=publish_id,
                    platform_post_url=None,  # TikTok doesn't return URL immediately
                    raw_response=init_data,
                )

        except Exception as e:
            logger.error("tiktok_publish_failed", error=str(e))
            return PublishResult(success=False, error_message=str(e))

    async def check_status(self, platform_post_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{TIKTOK_API_URL}/post/publish/status/fetch/",
                json={"publish_id": platform_post_id},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
            )
            response.raise_for_status()
            return response.json()
```

### Step 6: Instagram Publisher

Create `backend/app/services/publishers/instagram.py`:
```python
import time
import structlog
import httpx

from app.services.publishers.base import BasePublisher, PublishRequest, PublishResult

logger = structlog.get_logger()

GRAPH_URL = "https://graph.facebook.com/v21.0"


class InstagramPublisher(BasePublisher):
    """Publish to Instagram via Facebook Graph API (Reels/Video)."""

    async def publish(self, request: PublishRequest) -> PublishResult:
        try:
            metadata = request.platform_metadata or {}
            ig_account_id = metadata.get("instagram_account_id")
            if not ig_account_id:
                return PublishResult(success=False, error_message="Instagram account ID required in platform_metadata")

            # Build caption with hashtags
            caption = request.description or request.title or ""
            if request.hashtags:
                caption += "\n\n" + " ".join(request.hashtags)

            async with httpx.AsyncClient(timeout=300.0) as client:
                # Step 1: Create media container (Reel)
                # Video must be publicly accessible URL or hosted on Facebook CDN
                container_response = await client.post(
                    f"{GRAPH_URL}/{ig_account_id}/media",
                    data={
                        "media_type": "REELS",
                        "video_url": request.video_file_path,  # Must be a public URL
                        "caption": caption[:2200],  # Instagram max 2200 chars
                        "share_to_feed": metadata.get("share_to_feed", "true"),
                        "access_token": request.access_token,
                    },
                )
                container_response.raise_for_status()
                container_id = container_response.json()["id"]

                # Step 2: Wait for video processing
                max_attempts = 30
                for attempt in range(max_attempts):
                    status_response = await client.get(
                        f"{GRAPH_URL}/{container_id}",
                        params={
                            "fields": "status_code",
                            "access_token": request.access_token,
                        },
                    )
                    status_response.raise_for_status()
                    status_code = status_response.json().get("status_code")

                    if status_code == "FINISHED":
                        break
                    elif status_code == "ERROR":
                        return PublishResult(
                            success=False,
                            error_message="Instagram video processing failed",
                        )
                    else:
                        logger.info("instagram_processing", attempt=attempt, status=status_code)
                        time.sleep(10)  # Wait 10 seconds between checks
                else:
                    return PublishResult(
                        success=False,
                        error_message="Instagram video processing timed out",
                    )

                # Step 3: Publish the container
                publish_response = await client.post(
                    f"{GRAPH_URL}/{ig_account_id}/media_publish",
                    data={
                        "creation_id": container_id,
                        "access_token": request.access_token,
                    },
                )
                publish_response.raise_for_status()
                media_id = publish_response.json()["id"]

                # Step 4: Get permalink
                permalink_response = await client.get(
                    f"{GRAPH_URL}/{media_id}",
                    params={
                        "fields": "permalink",
                        "access_token": request.access_token,
                    },
                )
                permalink = permalink_response.json().get("permalink", "")

                return PublishResult(
                    success=True,
                    platform_post_id=media_id,
                    platform_post_url=permalink,
                )

        except Exception as e:
            logger.error("instagram_publish_failed", error=str(e))
            return PublishResult(success=False, error_message=str(e))

    async def check_status(self, platform_post_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GRAPH_URL}/{platform_post_id}",
                params={
                    "fields": "id,permalink,timestamp,like_count,comments_count",
                    "access_token": access_token,
                },
            )
            response.raise_for_status()
            return response.json()
```

### Step 7: Facebook Publisher

Create `backend/app/services/publishers/facebook.py`:
```python
import structlog
import httpx

from app.services.publishers.base import BasePublisher, PublishRequest, PublishResult

logger = structlog.get_logger()

GRAPH_URL = "https://graph.facebook.com/v21.0"


class FacebookPublisher(BasePublisher):
    async def publish(self, request: PublishRequest) -> PublishResult:
        try:
            metadata = request.platform_metadata or {}
            page_id = metadata.get("page_id")
            page_access_token = metadata.get("page_access_token", request.access_token)

            if not page_id:
                return PublishResult(success=False, error_message="Page ID required in platform_metadata")

            description = request.description or request.title or ""

            async with httpx.AsyncClient(timeout=300.0) as client:
                # Upload video to Facebook Page
                # For large videos, use resumable upload
                with open(request.video_file_path, "rb") as f:
                    response = await client.post(
                        f"{GRAPH_URL}/{page_id}/videos",
                        data={
                            "description": description[:8000],
                            "title": request.title[:255] if request.title else "",
                            "access_token": page_access_token,
                        },
                        files={"source": ("video.mp4", f, "video/mp4")},
                    )
                    response.raise_for_status()
                    data = response.json()

                video_id = data.get("id")
                return PublishResult(
                    success=True,
                    platform_post_id=video_id,
                    platform_post_url=f"https://www.facebook.com/{page_id}/videos/{video_id}",
                    raw_response=data,
                )

        except Exception as e:
            logger.error("facebook_publish_failed", error=str(e))
            return PublishResult(success=False, error_message=str(e))

    async def check_status(self, platform_post_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GRAPH_URL}/{platform_post_id}",
                params={
                    "fields": "id,status,permalink_url,views",
                    "access_token": access_token,
                },
            )
            response.raise_for_status()
            return response.json()
```

### Step 8: LinkedIn Publisher

Create `backend/app/services/publishers/linkedin.py`:
```python
import os
import structlog
import httpx

from app.services.publishers.base import BasePublisher, PublishRequest, PublishResult

logger = structlog.get_logger()

LINKEDIN_API = "https://api.linkedin.com/v2"


class LinkedInPublisher(BasePublisher):
    async def publish(self, request: PublishRequest) -> PublishResult:
        try:
            headers = {
                "Authorization": f"Bearer {request.access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            }

            metadata = request.platform_metadata or {}
            author_urn = metadata.get("author_urn")  # "urn:li:person:{id}"
            if not author_urn:
                # Get user's URN
                async with httpx.AsyncClient() as client:
                    me_response = await client.get(
                        "https://api.linkedin.com/v2/userinfo",
                        headers={"Authorization": f"Bearer {request.access_token}"},
                    )
                    me_response.raise_for_status()
                    author_urn = f"urn:li:person:{me_response.json()['sub']}"

            async with httpx.AsyncClient(timeout=300.0) as client:
                # Step 1: Register upload
                register_payload = {
                    "registerUploadRequest": {
                        "recipes": ["urn:li:digitalmediaRecipe:feedshare-video"],
                        "owner": author_urn,
                        "serviceRelationships": [
                            {
                                "relationshipType": "OWNER",
                                "identifier": "urn:li:userGeneratedContent",
                            }
                        ],
                    }
                }

                register_response = await client.post(
                    f"{LINKEDIN_API}/assets?action=registerUpload",
                    json=register_payload,
                    headers=headers,
                )
                register_response.raise_for_status()
                register_data = register_response.json()

                upload_url = register_data["value"]["uploadMechanism"][
                    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
                ]["uploadUrl"]
                asset = register_data["value"]["asset"]

                # Step 2: Upload video binary
                with open(request.video_file_path, "rb") as f:
                    upload_response = await client.put(
                        upload_url,
                        content=f.read(),
                        headers={
                            "Authorization": f"Bearer {request.access_token}",
                            "Content-Type": "application/octet-stream",
                        },
                    )
                    upload_response.raise_for_status()

                # Step 3: Create post with video
                text = request.description or request.title or ""
                if request.hashtags:
                    text += "\n\n" + " ".join(request.hashtags)

                post_payload = {
                    "author": author_urn,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {"text": text[:3000]},
                            "shareMediaCategory": "VIDEO",
                            "media": [
                                {
                                    "status": "READY",
                                    "media": asset,
                                    "title": {"text": request.title[:200] if request.title else ""},
                                }
                            ],
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": metadata.get("visibility", "PUBLIC")
                    },
                }

                post_response = await client.post(
                    f"{LINKEDIN_API}/ugcPosts",
                    json=post_payload,
                    headers=headers,
                )
                post_response.raise_for_status()
                post_id = post_response.headers.get("X-RestLi-Id", "")

                return PublishResult(
                    success=True,
                    platform_post_id=post_id,
                    platform_post_url=f"https://www.linkedin.com/feed/update/{post_id}",
                )

        except Exception as e:
            logger.error("linkedin_publish_failed", error=str(e))
            return PublishResult(success=False, error_message=str(e))

    async def check_status(self, platform_post_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{LINKEDIN_API}/ugcPosts/{platform_post_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
            )
            response.raise_for_status()
            return response.json()
```

### Step 9: X (Twitter) Publisher

Create `backend/app/services/publishers/x.py`:
```python
import os
import structlog
import httpx

from app.services.publishers.base import BasePublisher, PublishRequest, PublishResult

logger = structlog.get_logger()

X_API_URL = "https://api.twitter.com/2"
X_UPLOAD_URL = "https://upload.twitter.com/1.1/media/upload.json"


class XPublisher(BasePublisher):
    async def publish(self, request: PublishRequest) -> PublishResult:
        try:
            headers = {"Authorization": f"Bearer {request.access_token}"}

            async with httpx.AsyncClient(timeout=300.0) as client:
                # Step 1: INIT media upload
                file_size = os.path.getsize(request.video_file_path)
                init_response = await client.post(
                    X_UPLOAD_URL,
                    data={
                        "command": "INIT",
                        "total_bytes": file_size,
                        "media_type": "video/mp4",
                        "media_category": "tweet_video",
                    },
                    headers=headers,
                )
                init_response.raise_for_status()
                media_id = init_response.json()["media_id_string"]

                # Step 2: APPEND chunks
                chunk_size = 5 * 1024 * 1024  # 5MB
                with open(request.video_file_path, "rb") as f:
                    segment_index = 0
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        append_response = await client.post(
                            X_UPLOAD_URL,
                            data={
                                "command": "APPEND",
                                "media_id": media_id,
                                "segment_index": segment_index,
                            },
                            files={"media_data": chunk},
                            headers=headers,
                        )
                        append_response.raise_for_status()
                        segment_index += 1

                # Step 3: FINALIZE
                finalize_response = await client.post(
                    X_UPLOAD_URL,
                    data={"command": "FINALIZE", "media_id": media_id},
                    headers=headers,
                )
                finalize_response.raise_for_status()
                finalize_data = finalize_response.json()

                # Step 4: Wait for processing (poll STATUS)
                if "processing_info" in finalize_data:
                    import asyncio
                    while True:
                        wait_secs = finalize_data.get("processing_info", {}).get("check_after_secs", 5)
                        await asyncio.sleep(wait_secs)

                        status_response = await client.get(
                            X_UPLOAD_URL,
                            params={"command": "STATUS", "media_id": media_id},
                            headers=headers,
                        )
                        status_response.raise_for_status()
                        finalize_data = status_response.json()

                        state = finalize_data.get("processing_info", {}).get("state")
                        if state == "succeeded":
                            break
                        elif state == "failed":
                            error = finalize_data.get("processing_info", {}).get("error", {})
                            return PublishResult(
                                success=False,
                                error_message=f"Media processing failed: {error}",
                            )

                # Step 5: Create tweet with media
                text = request.title or ""
                if request.hashtags:
                    text += " " + " ".join(request.hashtags[:2])
                text = text[:280]  # X character limit

                tweet_response = await client.post(
                    f"{X_API_URL}/tweets",
                    json={
                        "text": text,
                        "media": {"media_ids": [media_id]},
                    },
                    headers={
                        **headers,
                        "Content-Type": "application/json",
                    },
                )
                tweet_response.raise_for_status()
                tweet_data = tweet_response.json()["data"]

                return PublishResult(
                    success=True,
                    platform_post_id=tweet_data["id"],
                    platform_post_url=f"https://x.com/i/status/{tweet_data['id']}",
                    raw_response=tweet_data,
                )

        except Exception as e:
            logger.error("x_publish_failed", error=str(e))
            return PublishResult(success=False, error_message=str(e))

    async def check_status(self, platform_post_id: str, access_token: str) -> dict:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{X_API_URL}/tweets/{platform_post_id}",
                params={"tweet.fields": "public_metrics,created_at"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()
```

### Step 10: Publishing Celery Tasks

Create `backend/app/tasks/publish.py`:
```python
import asyncio
import os
import structlog

from celery import Task
from sqlalchemy import select, and_
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.core.database import get_sync_session
from app.models.scheduled_post import ScheduledPost, PostStatus
from app.models.social_account import SocialAccount, Platform
from app.services.token_encryption import token_encryption
from app.services.social_account_service import SocialAccountService
from app.services.ai_content_generator import ai_content_generator
from app.services.publishers.base import PublishRequest
from app.services.publishers import (
    YouTubePublisher,
    TikTokPublisher,
    InstagramPublisher,
    FacebookPublisher,
    LinkedInPublisher,
    XPublisher,
)
from app.worker import celery_app

logger = structlog.get_logger()

PUBLISHERS = {
    "youtube": YouTubePublisher(),
    "tiktok": TikTokPublisher(),
    "instagram": InstagramPublisher(),
    "facebook": FacebookPublisher(),
    "linkedin": LinkedInPublisher(),
    "x": XPublisher(),
}


@celery_app.task(name="app.tasks.publish.check_due_posts")
def check_due_posts():
    """
    Celery Beat task: runs every minute.
    Finds all scheduled posts that are due and dispatches individual publish tasks.
    """
    now = datetime.now(timezone.utc)

    with get_sync_session() as db:
        result = db.execute(
            select(ScheduledPost).where(
                and_(
                    ScheduledPost.status == PostStatus.SCHEDULED,
                    ScheduledPost.scheduled_at <= now,
                )
            )
        )
        due_posts = result.scalars().all()

        for post in due_posts:
            # Mark as publishing to prevent double-dispatch
            post.status = PostStatus.PUBLISHING
            db.commit()

            # Dispatch individual publish task
            publish_to_platform.delay(str(post.id))
            logger.info("publish_dispatched", post_id=str(post.id), platform=post.platform)


@celery_app.task(
    name="app.tasks.publish.publish_to_platform",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,        # Exponential backoff: 60s, 120s, 240s
    retry_backoff_max=600,     # Max 10 minutes
)
def publish_to_platform(self: Task, scheduled_post_id: str):
    """Publish a single scheduled post to its target platform."""
    with get_sync_session() as db:
        # Load post and account
        post = db.execute(
            select(ScheduledPost).where(ScheduledPost.id == scheduled_post_id)
        ).scalar_one_or_none()

        if not post:
            logger.error("post_not_found", post_id=scheduled_post_id)
            return

        if post.status == PostStatus.PUBLISHED:
            logger.warning("post_already_published", post_id=scheduled_post_id)
            return

        account = db.execute(
            select(SocialAccount).where(SocialAccount.id == post.social_account_id)
        ).scalar_one_or_none()

        if not account or not account.is_active:
            post.status = PostStatus.FAILED
            post.error_message = "Social account not found or disconnected"
            db.commit()
            return

        try:
            # Get valid access token
            access_token = token_encryption.decrypt(account.access_token_encrypted)

            # Resolve video file path
            video_path = _resolve_video_path(post, db)
            if not video_path:
                post.status = PostStatus.FAILED
                post.error_message = "Video file not found"
                db.commit()
                return

            # Generate AI content if title/description is empty
            title = post.title
            description = post.description
            hashtags = post.hashtags

            if not title or not description:
                content_summary = title or description or "Video content"
                ai_metadata = asyncio.run(
                    ai_content_generator.generate(
                        platform=post.platform,
                        content_summary=content_summary,
                    )
                )
                if not title:
                    title = ai_metadata.get("title", ai_metadata.get("caption", ""))
                if not description:
                    description = ai_metadata.get("description", ai_metadata.get("text", ai_metadata.get("caption", "")))
                if not hashtags:
                    hashtags = ai_metadata.get("hashtags", ai_metadata.get("tags", []))

            # Build publish request
            publish_request = PublishRequest(
                video_file_path=video_path,
                title=title or "Untitled",
                description=description or "",
                hashtags=hashtags,
                thumbnail_path=post.thumbnail_url,
                access_token=access_token,
                platform_metadata={
                    **(post.platform_metadata or {}),
                    # Add account-specific metadata
                    "instagram_account_id": account.platform_user_id if post.platform == "instagram" else None,
                    "page_id": account.page_id if post.platform == "facebook" else None,
                    "page_access_token": (
                        token_encryption.decrypt(account.page_access_token_encrypted)
                        if account.page_access_token_encrypted and post.platform == "facebook"
                        else None
                    ),
                },
            )

            # Publish
            publisher = PUBLISHERS.get(post.platform)
            if not publisher:
                post.status = PostStatus.FAILED
                post.error_message = f"No publisher for platform: {post.platform}"
                db.commit()
                return

            result = asyncio.run(publisher.publish(publish_request))

            if result.success:
                post.status = PostStatus.PUBLISHED
                post.published_at = datetime.now(timezone.utc)
                post.platform_post_id = result.platform_post_id
                post.platform_post_url = result.platform_post_url
                post.error_message = None
                logger.info(
                    "publish_success",
                    post_id=scheduled_post_id,
                    platform=post.platform,
                    url=result.platform_post_url,
                )
            else:
                raise Exception(result.error_message)

            db.commit()

        except Exception as e:
            post.retry_count = (post.retry_count or 0) + 1

            if self.request.retries >= self.max_retries:
                post.status = PostStatus.FAILED
                post.error_message = f"Failed after {self.max_retries} retries: {str(e)}"
                logger.error(
                    "publish_failed_final",
                    post_id=scheduled_post_id,
                    platform=post.platform,
                    error=str(e),
                )
            else:
                post.status = PostStatus.PUBLISHING  # Keep as publishing for retry
                logger.warning(
                    "publish_retry",
                    post_id=scheduled_post_id,
                    attempt=self.request.retries + 1,
                    error=str(e),
                )

            db.commit()
            raise  # Re-raise for Celery retry


def _resolve_video_path(post: ScheduledPost, db: Session) -> str | None:
    """Resolve the local file path for the video/clip to publish."""
    # This will depend on your video/clip model structure
    # Placeholder: look up video by ID and return its file path
    if post.clip_id:
        from app.models.clip import Clip
        clip = db.execute(select(Clip).where(Clip.id == post.clip_id)).scalar_one_or_none()
        if clip and clip.output_path:
            return clip.output_path
    elif post.video_id:
        from app.models.video import Video
        video = db.execute(select(Video).where(Video.id == post.video_id)).scalar_one_or_none()
        if video and video.file_path:
            return video.file_path
    return None
```

### Step 11: Add Publishing to Celery Beat Schedule

Update `backend/app/worker.py`:
```python
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "refresh-expiring-tokens": {
        "task": "app.tasks.oauth.refresh_expiring_tokens",
        "schedule": crontab(minute="*/30"),
    },
    "check-due-posts": {
        "task": "app.tasks.publish.check_due_posts",
        "schedule": 60.0,  # Every 60 seconds
    },
}
```

### Step 12: Publishing Status API Endpoint

Add to `backend/app/api/v1/scheduled_posts.py`:
```python
@router.post("/{post_id}/publish-now")
async def publish_now(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScheduledPostResponse:
    """Immediately publish a scheduled post (skip the schedule)."""
    result = await db.execute(
        select(ScheduledPost).where(
            ScheduledPost.id == post_id,
            ScheduledPost.user_id == user.id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404)

    if post.status not in (PostStatus.SCHEDULED, PostStatus.DRAFT, PostStatus.FAILED):
        raise HTTPException(status_code=400, detail=f"Cannot publish post with status: {post.status}")

    post.status = PostStatus.PUBLISHING
    await db.commit()

    # Dispatch publish task
    from app.tasks.publish import publish_to_platform
    publish_to_platform.delay(str(post.id))

    await db.refresh(post)
    return ScheduledPostResponse(
        **{c.name: getattr(post, c.name) for c in ScheduledPost.__table__.columns},
    )
```

## Best Practices
- **Idempotent publishing:** Check `platform_post_id` before publishing to avoid duplicates on retry.
- **Exponential backoff:** Use Celery's `retry_backoff=True` for increasing delays between retries.
- **Rate limits:** Each platform has API rate limits. Implement per-platform rate limiting in the publish queue (e.g., YouTube: 6 uploads/day default quota).
- **Video file access:** Ensure the video file is accessible from the worker. Use GCS URLs for cloud deployments; for Instagram, the video URL must be publicly accessible.
- **AI generation fallback:** If Qwen3 fails to generate content, use the user-provided title/description as-is rather than failing the publish.
- **Status updates in real-time:** Use WebSocket or SSE to push publish status updates to the frontend calendar.

## Testing
- **Mock publishers:** In tests, mock the platform API calls and verify the publish flow end-to-end.
- **Test retry logic:** Simulate failures and verify posts retry with correct backoff.
- **Test AI content generation:** Mock Ollama and verify generated metadata is applied correctly.

```python
# backend/tests/test_publish.py
import pytest
from unittest.mock import patch, MagicMock
from app.tasks.publish import publish_to_platform
from app.services.publishers.base import PublishResult


@pytest.fixture
def mock_publisher():
    with patch("app.tasks.publish.PUBLISHERS") as mock:
        publisher = MagicMock()
        publisher.publish.return_value = PublishResult(
            success=True,
            platform_post_id="yt_12345",
            platform_post_url="https://youtube.com/watch?v=yt_12345",
        )
        mock.__getitem__ = MagicMock(return_value=publisher)
        mock.get = MagicMock(return_value=publisher)
        yield publisher


def test_publish_success(mock_publisher, db_session, sample_scheduled_post):
    publish_to_platform(str(sample_scheduled_post.id))
    db_session.refresh(sample_scheduled_post)
    assert sample_scheduled_post.status == "published"
    assert sample_scheduled_post.platform_post_id == "yt_12345"
```

## Verification Checklist
- [ ] Celery Beat `check_due_posts` runs every minute and finds due posts
- [ ] Posts transition: `scheduled` -> `publishing` -> `published` (or `failed`)
- [ ] YouTube publisher: resumable upload with progress, thumbnail upload
- [ ] TikTok publisher: chunked upload via Content Posting API
- [ ] Instagram publisher: container creation, processing wait, publish
- [ ] Facebook publisher: page video upload with page access token
- [ ] LinkedIn publisher: registered upload + UGC post creation
- [ ] X publisher: chunked media upload + tweet creation
- [ ] AI content generation fills in missing titles/descriptions/hashtags per platform
- [ ] Retry logic: 3 retries with exponential backoff
- [ ] Failed posts show error message in calendar UI
- [ ] "Publish Now" button works for manual immediate publishing
- [ ] Token refresh is performed before publishing if token is near expiry
- [ ] Rate limiting prevents exceeding platform API quotas
- [ ] Double-publish prevention via status check before publishing
