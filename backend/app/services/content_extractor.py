"""Content extraction from URLs, Reddit posts, and generic web pages."""

import json
import logging
import re
import subprocess

import httpx

logger = logging.getLogger(__name__)


async def extract_content(url: str) -> dict:
    """Extract content from a URL based on its type.

    Returns: {"source_type": str, "title": str, "content": str, "metadata": dict}
    """
    if _is_youtube_url(url):
        return await extract_youtube(url)
    elif _is_reddit_url(url):
        return await extract_reddit(url)
    else:
        return await extract_webpage(url)


async def extract_youtube(url: str) -> dict:
    """Extract transcript from a YouTube video using yt-dlp."""
    try:
        # Get video info
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-download", url],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise ValueError(f"yt-dlp failed: {result.stderr}")

        info = json.loads(result.stdout)
        title = info.get("title", "")
        description = info.get("description", "")
        duration = info.get("duration", 0)

        # Try to get subtitles/transcript
        transcript = ""
        sub_result = subprocess.run(
            [
                "yt-dlp",
                "--skip-download",
                "--write-auto-sub",
                "--sub-lang", "en",
                "--sub-format", "vtt",
                "--output", "/tmp/openclip/yt_%(id)s",
                url,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        video_id = info.get("id", "")
        vtt_path = f"/tmp/openclip/yt_{video_id}.en.vtt"
        try:
            with open(vtt_path) as f:
                transcript = _parse_vtt(f.read())
        except FileNotFoundError:
            transcript = description

        return {
            "source_type": "youtube",
            "title": title,
            "content": transcript or description,
            "metadata": {
                "video_id": video_id,
                "channel": info.get("channel", ""),
                "duration": duration,
                "view_count": info.get("view_count", 0),
            },
        }
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        logger.warning("YouTube extraction failed for %s: %s", url, e)
        return {
            "source_type": "youtube",
            "title": "",
            "content": "",
            "metadata": {"error": str(e), "url": url},
        }


async def extract_reddit(url: str) -> dict:
    """Extract post content from Reddit using the JSON API."""
    json_url = url.rstrip("/") + ".json"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            json_url,
            headers={"User-Agent": "OpenClip/1.0"},
        )
        if resp.status_code != 200:
            return {
                "source_type": "reddit",
                "title": "",
                "content": "",
                "metadata": {"error": f"HTTP {resp.status_code}", "url": url},
            }

        data = resp.json()
        post_data = data[0]["data"]["children"][0]["data"]
        title = post_data.get("title", "")
        selftext = post_data.get("selftext", "")
        subreddit = post_data.get("subreddit", "")
        score = post_data.get("score", 0)

        # Get top comments
        comments = []
        if len(data) > 1:
            for child in data[1]["data"]["children"][:10]:
                if child["kind"] == "t1":
                    comment_body = child["data"].get("body", "")
                    comment_score = child["data"].get("score", 0)
                    if comment_body and comment_score > 0:
                        comments.append({
                            "text": comment_body,
                            "score": comment_score,
                        })

        content_parts = [title, selftext]
        if comments:
            content_parts.append("\n\nTop comments:")
            for c in comments[:5]:
                content_parts.append(f"- {c['text']}")

        return {
            "source_type": "reddit",
            "title": title,
            "content": "\n\n".join(content_parts),
            "metadata": {
                "subreddit": subreddit,
                "score": score,
                "comment_count": len(comments),
                "url": url,
            },
        }


async def extract_webpage(url: str) -> dict:
    """Extract article text from a generic webpage."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(
            url,
            headers={"User-Agent": "OpenClip/1.0"},
        )
        if resp.status_code != 200:
            return {
                "source_type": "webpage",
                "title": "",
                "content": "",
                "metadata": {"error": f"HTTP {resp.status_code}", "url": url},
            }

        html = resp.text

        # Simple extraction: title + text content
        title = _extract_html_title(html)
        text = _extract_text_from_html(html)

        return {
            "source_type": "webpage",
            "title": title,
            "content": text[:10000],  # limit to 10k chars
            "metadata": {"url": url},
        }


def _is_youtube_url(url: str) -> bool:
    return bool(re.search(r"(youtube\.com|youtu\.be)", url, re.I))


def _is_reddit_url(url: str) -> bool:
    return bool(re.search(r"(reddit\.com|redd\.it)", url, re.I))


def _parse_vtt(vtt_content: str) -> str:
    """Extract plain text from WebVTT content."""
    lines = []
    for line in vtt_content.split("\n"):
        line = line.strip()
        if not line or line.startswith("WEBVTT") or "-->" in line or line.isdigit():
            continue
        # Remove VTT tags
        line = re.sub(r"<[^>]+>", "", line)
        if line and line not in lines:
            lines.append(line)
    return " ".join(lines)


def _extract_html_title(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    return match.group(1).strip() if match else ""


def _extract_text_from_html(html: str) -> str:
    """Basic HTML to text extraction."""
    # Remove script and style blocks
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.I | re.S)
    # Remove tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text
