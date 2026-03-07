# URL & Reddit Content Input — Implementation Guide

## Overview
- **What:** Build a content extraction pipeline that accepts URLs (YouTube, blog posts, articles) and Reddit posts as input, extracts the text content, and feeds it into the script generation pipeline. Use PRAW for Reddit API access (posts, comments, screenshots), newspaper3k/trafilatura for article extraction, and yt-dlp for YouTube transcript extraction.
- **Why:** Users should not have to manually write scripts. The most common faceless video workflow is: find interesting content online, convert it into a video. This feature automates the "find and extract" step, enabling URL-to-video and Reddit-post-to-video workflows.
- **Dependencies:** Phase 3 Feature 2 (Script Generation), Phase 1 Feature 2 (FastAPI Backend)

## Architecture

### Content Extraction Pipeline
```
User Input
  ├── URL → Type Detection:
  │     ├── YouTube URL → yt-dlp transcript extraction
  │     ├── Reddit URL → PRAW API (post + comments)
  │     └── Article URL → trafilatura/newspaper3k extraction
  │
  ├── Reddit Post ID → PRAW API direct
  │
  └── Raw Text → Pass through

  → Extracted Content (text, metadata)
  → Script Generation (LLM converts content to video script)
  → Faceless Video Pipeline
```

### URL Detection Logic
```
URL Pattern                          → Handler
─────────────────────────────────────────────────
youtube.com/watch?v=                 → YouTube transcript
youtu.be/                            → YouTube transcript
reddit.com/r/*/comments/*           → Reddit post
old.reddit.com/r/*/comments/*       → Reddit post
*.medium.com/*                       → Article extraction
*.substack.com/*                     → Article extraction
*.wordpress.com/*                    → Article extraction
Any other URL                        → Generic article extraction
```

### Data Flow
```
1. User provides URL or Reddit post link
2. Backend detects content type
3. Appropriate extractor fetches and parses content
4. Content cleaned and structured:
   {
     "source": "reddit",
     "title": "AITA for telling my sister...",
     "body": "So this happened last week...",
     "author": "u/anonymous",
     "metadata": {"upvotes": 12500, "comments": 890, "subreddit": "AmItheAsshole"},
     "top_comments": ["NTA - your sister...", "YTA - you should..."]
   }
5. Content passed to Script Generation service
6. Script generated and returned to user for review
```

## GCP Deployment
- No additional GCP service required. Runs within the existing FastAPI backend.
- Reddit API access uses PRAW (Python Reddit API Wrapper) with OAuth credentials.
- YouTube transcript extraction uses yt-dlp (no API key needed).
- Article extraction uses trafilatura (no API key needed).

## Step-by-Step Implementation

### Step 1: Install Dependencies
Add to `backend/requirements.txt`:
```
praw>=7.7.0
trafilatura>=1.12.0
yt-dlp>=2024.8.0
beautifulsoup4>=4.12.0
newspaper3k>=0.2.8
validators>=0.33.0
```

### Step 2: Create Content Extraction Models
Create `backend/app/schemas/content.py`:
```python
from enum import Enum
from pydantic import BaseModel, Field, HttpUrl


class ContentSource(str, Enum):
    YOUTUBE = "youtube"
    REDDIT = "reddit"
    ARTICLE = "article"
    RAW_TEXT = "raw_text"


class RedditMetadata(BaseModel):
    subreddit: str = ""
    upvotes: int = 0
    upvote_ratio: float = 0.0
    num_comments: int = 0
    author: str = ""
    created_utc: float = 0.0
    permalink: str = ""
    is_nsfw: bool = False
    flair: str | None = None


class YouTubeMetadata(BaseModel):
    video_id: str = ""
    channel: str = ""
    duration: int = 0  # seconds
    view_count: int = 0
    upload_date: str = ""


class ArticleMetadata(BaseModel):
    domain: str = ""
    author: str | None = None
    publish_date: str | None = None
    language: str = "en"


class ExtractedContent(BaseModel):
    source: ContentSource
    title: str
    body: str
    url: str = ""
    metadata: dict = {}
    top_comments: list[str] = Field(default_factory=list)
    word_count: int = 0
    estimated_read_time: int = 0  # seconds

    def summary(self) -> str:
        """Create a brief summary for logging."""
        return f"[{self.source}] {self.title[:60]}... ({self.word_count} words)"


class ContentExtractionRequest(BaseModel):
    url: str | None = None
    text: str | None = None
    reddit_post_id: str | None = None
    include_comments: bool = True
    max_comments: int = 10


class ContentToVideoRequest(BaseModel):
    url: str | None = None
    text: str | None = None
    reddit_post_id: str | None = None
    include_comments: bool = True
    max_comments: int = 10
    style: str = "documentary"
    duration: int = 60
    audience: str = "general"
    voice: str = "af_heart"
    template: str | None = None  # Auto-select if None
```

### Step 3: Create URL Type Detector
Create `backend/app/services/extractors/url_detector.py`:
```python
import re
from urllib.parse import urlparse

from app.schemas.content import ContentSource


def detect_url_type(url: str) -> ContentSource:
    """Detect the type of content from a URL."""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()

    # YouTube
    if any(yt in domain for yt in ["youtube.com", "youtu.be", "youtube-nocookie.com"]):
        return ContentSource.YOUTUBE

    # Reddit
    if any(rd in domain for rd in ["reddit.com", "old.reddit.com", "redd.it"]):
        return ContentSource.REDDIT

    # Default to article
    return ContentSource.ARTICLE


def extract_youtube_id(url: str) -> str | None:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"youtube\.com/shorts/([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_reddit_post_id(url: str) -> str | None:
    """Extract Reddit post ID from URL."""
    pattern = r"reddit\.com/r/\w+/comments/([a-zA-Z0-9]+)"
    match = re.search(pattern, url)
    return match.group(1) if match else None
```

### Step 4: Create Reddit Extractor
Create `backend/app/services/extractors/reddit_extractor.py`:
```python
import praw
import structlog

from app.core.config import settings
from app.schemas.content import ContentSource, ExtractedContent, RedditMetadata

logger = structlog.get_logger()


class RedditExtractor:
    """Extract content from Reddit posts and comments using PRAW."""

    def __init__(self):
        self.reddit = praw.Reddit(
            client_id=settings.REDDIT_CLIENT_ID,
            client_secret=settings.REDDIT_CLIENT_SECRET,
            user_agent=settings.REDDIT_USER_AGENT or "OpenClip/1.0",
        )
        # Read-only mode (no user auth needed)
        self.reddit.read_only = True

    def extract_post(
        self,
        post_id: str | None = None,
        url: str | None = None,
        include_comments: bool = True,
        max_comments: int = 10,
    ) -> ExtractedContent:
        """
        Extract content from a Reddit post.

        Args:
            post_id: Reddit post ID (e.g., "1abc2de").
            url: Full Reddit post URL.
            include_comments: Whether to fetch top comments.
            max_comments: Maximum number of comments to fetch.

        Returns:
            ExtractedContent with post text and top comments.
        """
        if url:
            submission = self.reddit.submission(url=url)
        elif post_id:
            submission = self.reddit.submission(id=post_id)
        else:
            raise ValueError("Provide either post_id or url")

        logger.info(
            "reddit.extract",
            subreddit=submission.subreddit.display_name,
            title=submission.title[:80],
        )

        # Get post body
        body = submission.selftext or ""

        # If it is a link post (not self post), note the linked URL
        if not submission.is_self and submission.url:
            body = f"[Link: {submission.url}]\n\n{body}"

        # Get top comments
        top_comments = []
        if include_comments:
            submission.comment_sort = "top"
            submission.comments.replace_more(limit=0)
            for comment in submission.comments[:max_comments]:
                if hasattr(comment, "body") and len(comment.body) > 20:
                    top_comments.append(comment.body)

        # Build metadata
        metadata = RedditMetadata(
            subreddit=submission.subreddit.display_name,
            upvotes=submission.score,
            upvote_ratio=submission.upvote_ratio,
            num_comments=submission.num_comments,
            author=str(submission.author) if submission.author else "[deleted]",
            created_utc=submission.created_utc,
            permalink=submission.permalink,
            is_nsfw=submission.over_18,
            flair=submission.link_flair_text,
        )

        word_count = len(body.split()) + sum(len(c.split()) for c in top_comments)

        return ExtractedContent(
            source=ContentSource.REDDIT,
            title=submission.title,
            body=body,
            url=f"https://reddit.com{submission.permalink}",
            metadata=metadata.model_dump(),
            top_comments=top_comments,
            word_count=word_count,
            estimated_read_time=int(word_count / 3.5),  # Average reading speed for narration
        )

    def search_posts(
        self,
        query: str,
        subreddit: str = "all",
        sort: str = "top",
        time_filter: str = "month",
        limit: int = 10,
    ) -> list[dict]:
        """Search Reddit for posts matching a query."""
        results = []
        sub = self.reddit.subreddit(subreddit)

        for submission in sub.search(query, sort=sort, time_filter=time_filter, limit=limit):
            results.append({
                "id": submission.id,
                "title": submission.title,
                "subreddit": submission.subreddit.display_name,
                "score": submission.score,
                "num_comments": submission.num_comments,
                "url": f"https://reddit.com{submission.permalink}",
                "is_self": submission.is_self,
                "body_preview": (submission.selftext or "")[:200],
            })

        return results
```

### Step 5: Create YouTube Extractor
Create `backend/app/services/extractors/youtube_extractor.py`:
```python
import json
import subprocess
import tempfile
from pathlib import Path

import structlog

from app.schemas.content import ContentSource, ExtractedContent, YouTubeMetadata
from app.services.extractors.url_detector import extract_youtube_id

logger = structlog.get_logger()


class YouTubeExtractor:
    """Extract transcripts and metadata from YouTube videos using yt-dlp."""

    def extract(self, url: str) -> ExtractedContent:
        """
        Extract transcript and metadata from a YouTube video.

        Uses yt-dlp to download subtitles (auto-generated if no manual subs).
        """
        video_id = extract_youtube_id(url)
        if not video_id:
            raise ValueError(f"Could not extract YouTube video ID from: {url}")

        logger.info("youtube.extract", video_id=video_id)

        # Get video metadata
        metadata = self._get_metadata(url)

        # Get transcript
        transcript = self._get_transcript(url, video_id)

        word_count = len(transcript.split())

        return ExtractedContent(
            source=ContentSource.YOUTUBE,
            title=metadata.get("title", ""),
            body=transcript,
            url=url,
            metadata=YouTubeMetadata(
                video_id=video_id,
                channel=metadata.get("channel", ""),
                duration=metadata.get("duration", 0),
                view_count=metadata.get("view_count", 0),
                upload_date=metadata.get("upload_date", ""),
            ).model_dump(),
            word_count=word_count,
            estimated_read_time=int(word_count / 3.5),
        )

    def _get_metadata(self, url: str) -> dict:
        """Get video metadata using yt-dlp."""
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-playlist",
            url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            logger.warning("youtube.metadata_failed", error=result.stderr[:200])
            return {}
        return json.loads(result.stdout)

    def _get_transcript(self, url: str, video_id: str) -> str:
        """Download and parse subtitles."""
        with tempfile.TemporaryDirectory() as tmp_dir:
            output_path = str(Path(tmp_dir) / "subs")

            # Try to get manual subtitles first, then auto-generated
            cmd = [
                "yt-dlp",
                "--write-subs",
                "--write-auto-subs",
                "--sub-lang", "en",
                "--sub-format", "vtt",
                "--skip-download",
                "--no-playlist",
                "-o", output_path,
                url,
            ]
            subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            # Find the subtitle file
            sub_files = list(Path(tmp_dir).glob("*.vtt"))
            if not sub_files:
                logger.warning("youtube.no_subs", video_id=video_id)
                return "[No transcript available for this video]"

            # Parse VTT file
            return self._parse_vtt(str(sub_files[0]))

    @staticmethod
    def _parse_vtt(vtt_path: str) -> str:
        """Parse WebVTT subtitles into plain text."""
        with open(vtt_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        text_lines = []
        seen = set()

        for line in lines:
            line = line.strip()
            # Skip VTT metadata, timestamps, and empty lines
            if (
                not line
                or line.startswith("WEBVTT")
                or line.startswith("Kind:")
                or line.startswith("Language:")
                or "-->" in line
                or line.isdigit()
            ):
                continue

            # Remove HTML tags
            import re
            clean = re.sub(r"<[^>]+>", "", line)
            clean = clean.strip()

            # Deduplicate (auto-generated subs repeat lines)
            if clean and clean not in seen:
                seen.add(clean)
                text_lines.append(clean)

        return " ".join(text_lines)
```

### Step 6: Create Article Extractor
Create `backend/app/services/extractors/article_extractor.py`:
```python
import structlog
import trafilatura

from app.schemas.content import ArticleMetadata, ContentSource, ExtractedContent

logger = structlog.get_logger()


class ArticleExtractor:
    """Extract article content from web URLs using trafilatura."""

    def extract(self, url: str) -> ExtractedContent:
        """
        Extract article text from a URL.

        Uses trafilatura for robust content extraction from any web page.
        Falls back to newspaper3k if trafilatura fails.
        """
        logger.info("article.extract", url=url[:100])

        # Try trafilatura first (better quality extraction)
        content = self._extract_trafilatura(url)

        if not content or len(content.get("body", "")) < 50:
            # Fallback to newspaper3k
            content = self._extract_newspaper(url)

        if not content or len(content.get("body", "")) < 50:
            raise ValueError(f"Could not extract content from: {url}")

        body = content["body"]
        word_count = len(body.split())

        return ExtractedContent(
            source=ContentSource.ARTICLE,
            title=content.get("title", ""),
            body=body,
            url=url,
            metadata=ArticleMetadata(
                domain=content.get("domain", ""),
                author=content.get("author"),
                publish_date=content.get("publish_date"),
                language=content.get("language", "en"),
            ).model_dump(),
            word_count=word_count,
            estimated_read_time=int(word_count / 3.5),
        )

    def _extract_trafilatura(self, url: str) -> dict | None:
        """Extract using trafilatura."""
        try:
            downloaded = trafilatura.fetch_url(url)
            if not downloaded:
                return None

            result = trafilatura.extract(
                downloaded,
                include_comments=False,
                include_tables=False,
                output_format="json",
                with_metadata=True,
            )

            if not result:
                return None

            import json
            data = json.loads(result) if isinstance(result, str) else result

            from urllib.parse import urlparse
            domain = urlparse(url).netloc

            return {
                "title": data.get("title", ""),
                "body": data.get("text", ""),
                "author": data.get("author"),
                "publish_date": data.get("date"),
                "domain": domain,
                "language": data.get("language", "en"),
            }
        except Exception as e:
            logger.warning("trafilatura.failed", url=url[:80], error=str(e)[:100])
            return None

    def _extract_newspaper(self, url: str) -> dict | None:
        """Fallback: extract using newspaper3k."""
        try:
            from newspaper import Article

            article = Article(url)
            article.download()
            article.parse()

            from urllib.parse import urlparse
            domain = urlparse(url).netloc

            return {
                "title": article.title or "",
                "body": article.text or "",
                "author": ", ".join(article.authors) if article.authors else None,
                "publish_date": str(article.publish_date) if article.publish_date else None,
                "domain": domain,
                "language": "en",
            }
        except Exception as e:
            logger.warning("newspaper.failed", url=url[:80], error=str(e)[:100])
            return None
```

### Step 7: Create Unified Content Extraction Service
Create `backend/app/services/content_service.py`:
```python
import structlog

from app.schemas.content import (
    ContentExtractionRequest,
    ContentSource,
    ExtractedContent,
)
from app.services.extractors.article_extractor import ArticleExtractor
from app.services.extractors.reddit_extractor import RedditExtractor
from app.services.extractors.url_detector import (
    detect_url_type,
    extract_reddit_post_id,
)
from app.services.extractors.youtube_extractor import YouTubeExtractor

logger = structlog.get_logger()


class ContentService:
    """Unified content extraction service."""

    def __init__(self):
        self.reddit = RedditExtractor()
        self.youtube = YouTubeExtractor()
        self.article = ArticleExtractor()

    async def extract(self, request: ContentExtractionRequest) -> ExtractedContent:
        """
        Extract content from any supported input.

        Priority:
        1. Direct text input
        2. Reddit post ID
        3. URL (auto-detected type)
        """
        # Raw text passthrough
        if request.text:
            word_count = len(request.text.split())
            return ExtractedContent(
                source=ContentSource.RAW_TEXT,
                title="User-provided text",
                body=request.text,
                word_count=word_count,
                estimated_read_time=int(word_count / 3.5),
            )

        # Direct Reddit post ID
        if request.reddit_post_id:
            return self.reddit.extract_post(
                post_id=request.reddit_post_id,
                include_comments=request.include_comments,
                max_comments=request.max_comments,
            )

        # URL-based extraction
        if request.url:
            source_type = detect_url_type(request.url)
            logger.info("content.extract", url=request.url[:100], type=source_type)

            if source_type == ContentSource.REDDIT:
                post_id = extract_reddit_post_id(request.url)
                return self.reddit.extract_post(
                    url=request.url,
                    include_comments=request.include_comments,
                    max_comments=request.max_comments,
                )

            if source_type == ContentSource.YOUTUBE:
                return self.youtube.extract(request.url)

            # Default: article
            return self.article.extract(request.url)

        raise ValueError("Provide at least one of: url, text, reddit_post_id")
```

### Step 8: Create API Endpoints
Create `backend/app/api/v1/content.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.content import (
    ContentExtractionRequest,
    ContentToVideoRequest,
    ExtractedContent,
)
from app.services.content_service import ContentService
from app.services.script_service import ScriptService

router = APIRouter()


@router.post("/extract", response_model=ExtractedContent)
async def extract_content(
    request: ContentExtractionRequest,
    user: User = Depends(get_current_user),
):
    """
    Extract content from a URL, Reddit post, or raw text.

    Supports:
    - YouTube URLs (transcript extraction)
    - Reddit URLs or post IDs (post + comments)
    - Article/blog URLs (text extraction)
    - Raw text input
    """
    service = ContentService()
    try:
        content = await service.extract(request)
        return content
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)[:200]}")


@router.post("/to-script")
async def content_to_script(
    request: ContentToVideoRequest,
    user: User = Depends(get_current_user),
):
    """
    Extract content and immediately generate a video script.

    One-step: URL/text → extracted content → video script.
    """
    content_service = ContentService()
    script_service = ScriptService()

    try:
        # Step 1: Extract content
        extraction_request = ContentExtractionRequest(
            url=request.url,
            text=request.text,
            reddit_post_id=request.reddit_post_id,
            include_comments=request.include_comments,
            max_comments=request.max_comments,
        )
        content = await content_service.extract(extraction_request)

        # Step 2: Build content string for script generation
        full_content = content.body
        if content.top_comments:
            full_content += "\n\nTOP COMMENTS:\n" + "\n---\n".join(content.top_comments[:5])

        # Step 3: Auto-select style based on content source
        style = request.style
        if style == "documentary" and content.source.value == "reddit":
            style = "reddit"  # Auto-switch to reddit style for Reddit content

        # Step 4: Generate script from content
        script = await script_service.generate_from_content(
            content=full_content,
            style=style,
            duration=request.duration,
            audience=request.audience,
        )

        return {
            "content": {
                "source": content.source,
                "title": content.title,
                "word_count": content.word_count,
                "url": content.url,
            },
            "script": script.model_dump(),
            "suggested_template": request.template or _auto_template(content.source.value, style),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)[:200]}")


@router.post("/reddit/search")
async def search_reddit(
    query: str,
    subreddit: str = "all",
    sort: str = "top",
    time_filter: str = "month",
    limit: int = 10,
    user: User = Depends(get_current_user),
):
    """Search Reddit for posts to convert into videos."""
    service = ContentService()
    results = service.reddit.search_posts(
        query=query,
        subreddit=subreddit,
        sort=sort,
        time_filter=time_filter,
        limit=limit,
    )
    return {"results": results}


def _auto_template(source: str, style: str) -> str:
    """Auto-select template based on content source and style."""
    if source == "reddit":
        return "reddit_story"
    template_map = {
        "documentary": "documentary",
        "listicle": "listicle",
        "story": "reddit_story",
        "motivational": "motivational",
        "educational": "educational",
        "scary": "scary_story",
        "reddit": "reddit_story",
    }
    return template_map.get(style, "documentary")
```

### Step 9: Add Configuration
Add to `backend/app/core/config.py`:
```python
# Reddit API (PRAW)
REDDIT_CLIENT_ID: str = ""
REDDIT_CLIENT_SECRET: str = ""
REDDIT_USER_AGENT: str = "OpenClip/1.0 (Content extraction for video creation)"
```

Store Reddit credentials in GCP Secret Manager:
```bash
echo -n "YOUR_REDDIT_CLIENT_ID" | gcloud secrets create reddit-client-id --data-file=-
echo -n "YOUR_REDDIT_CLIENT_SECRET" | gcloud secrets create reddit-client-secret --data-file=-
```

### Step 10: Register Routes
Add to router registration:
```python
from app.api.v1.content import router as content_router

api_router.include_router(content_router, prefix="/content", tags=["content"])
```

## Best Practices

- **Reddit API rate limits:** PRAW has a built-in rate limiter (60 requests/minute). Do not bypass it. For bulk extraction, add delays between requests.
- **Reddit read-only mode:** Use `reddit.read_only = True`. OpenClip only needs to read posts, never write. This avoids needing user-level OAuth.
- **Reddit credentials:** Create a Reddit "script" application at https://www.reddit.com/prefs/apps. The client ID is under the app name; the secret is labeled "secret."
- **YouTube fallback:** yt-dlp auto-generated subtitles have lower quality than manual captions. Always try manual subs first. Flag to the user if only auto-subs are available.
- **Content length limits:** Truncate extracted content to 8000 characters before sending to the LLM. Longer content exceeds the effective prompt window and degrades script quality.
- **NSFW filtering:** Check `submission.over_18` for Reddit posts. Flag NSFW content to the user; do not auto-process it.
- **Error handling per extractor:** Each extractor should fail gracefully. If YouTube transcripts are unavailable, return a clear error. If an article cannot be parsed, suggest trying a different URL.
- **Caching:** Cache extracted content by URL in Redis for 1 hour. Repeated requests for the same URL should not re-fetch.

## Testing

### Manual Testing
```bash
# Extract from Reddit post
curl -X POST http://localhost:8000/api/v1/content/extract \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://reddit.com/r/AmItheAsshole/comments/example123"}'

# Extract from YouTube video
curl -X POST http://localhost:8000/api/v1/content/extract \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Extract from article
curl -X POST http://localhost:8000/api/v1/content/extract \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/interesting-article"}'

# Full pipeline: URL to script
curl -X POST http://localhost:8000/api/v1/content/to-script \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://reddit.com/r/tifu/comments/example", "style": "reddit", "duration": 60}'

# Search Reddit
curl -X POST "http://localhost:8000/api/v1/content/reddit/search?query=AITA&subreddit=AmItheAsshole&sort=top&limit=5" \
  -H "Authorization: Bearer TOKEN"
```

### Unit Tests
```python
import pytest
from app.services.extractors.url_detector import detect_url_type, extract_youtube_id, extract_reddit_post_id
from app.schemas.content import ContentSource


def test_detect_youtube():
    assert detect_url_type("https://www.youtube.com/watch?v=abc123") == ContentSource.YOUTUBE
    assert detect_url_type("https://youtu.be/abc123") == ContentSource.YOUTUBE


def test_detect_reddit():
    assert detect_url_type("https://reddit.com/r/test/comments/abc123/title") == ContentSource.REDDIT
    assert detect_url_type("https://old.reddit.com/r/test/comments/abc") == ContentSource.REDDIT


def test_detect_article():
    assert detect_url_type("https://example.com/article") == ContentSource.ARTICLE
    assert detect_url_type("https://medium.com/@user/post") == ContentSource.ARTICLE


def test_extract_youtube_id():
    assert extract_youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert extract_youtube_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert extract_youtube_id("not a url") is None


def test_extract_reddit_post_id():
    assert extract_reddit_post_id("https://reddit.com/r/test/comments/abc123/title") == "abc123"
    assert extract_reddit_post_id("not a url") is None
```

## Verification Checklist
- [ ] URL type detection correctly identifies YouTube, Reddit, and article URLs
- [ ] Reddit extractor fetches post title, body, and metadata via PRAW
- [ ] Reddit extractor fetches top N comments
- [ ] YouTube extractor downloads transcript via yt-dlp
- [ ] YouTube extractor falls back to auto-generated subtitles
- [ ] Article extractor parses content via trafilatura
- [ ] Article extractor falls back to newspaper3k
- [ ] Raw text passthrough works
- [ ] Content-to-script pipeline generates a valid script from URL
- [ ] Reddit content auto-selects "reddit" script style
- [ ] Reddit search returns relevant posts
- [ ] NSFW content is flagged
- [ ] Content is truncated to 8000 chars before LLM
- [ ] Error handling returns clear messages for unsupported URLs
- [ ] Reddit API credentials are stored in Secret Manager
