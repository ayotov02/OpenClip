#!/usr/bin/env python3
"""
Reddit Scraper for Video Tool Feature Requests & Community Insights

Scrapes Reddit posts from targeted subreddits to extract:
- Feature requests for video editing/clipping tools
- Pain points with existing tools (OpusClip, Kapwing, etc.)
- Faceless video creator needs
- Self-hosted/open-source tool demands
- Pricing complaints and wishlist items

Requirements:
    pip install praw prawcore pandas

Usage:
    # Set environment variables:
    export REDDIT_CLIENT_ID="your_client_id"
    export REDDIT_CLIENT_SECRET="your_client_secret"
    export REDDIT_USER_AGENT="VideoAPIResearch/1.0"

    # Run:
    python reddit_scraper.py

    # Or with custom output:
    python reddit_scraper.py --output ./data/reddit_research.json --limit 200

To get Reddit API credentials:
    1. Go to https://www.reddit.com/prefs/apps
    2. Click "create another app"
    3. Select "script"
    4. Fill in name and redirect URI (http://localhost:8080)
    5. Copy client_id (under app name) and client_secret
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import praw
    import prawcore
except ImportError:
    print("Error: praw is required. Install with: pip install praw prawcore")
    sys.exit(1)

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False


# --- Configuration ---

TARGET_SUBREDDITS = [
    "NewTubers",
    "youtubers",
    "VideoEditing",
    "artificial",
    "SideProject",
    "socialmedia",
    "content_marketing",
    "Entrepreneur",
    "startups",
    "selfhosted",
    "shortcuts",
    "automation",
    "TikTokHelp",
    "Instagram",
    "PartneredYoutube",
]

SEARCH_QUERIES = [
    # OpusClip & competitors
    "OpusClip",
    "opus clip alternative",
    "opus clip review",
    "video clipping tool",
    "AI video clipping",
    "long to short video",
    "video repurposing tool",
    # Specific competitors
    "Vizard ai",
    "Submagic",
    "Klap app",
    "Kapwing",
    "Descript",
    "CapCut AI",
    "Captions app",
    "Pictory",
    # Faceless video
    "faceless video",
    "faceless YouTube channel",
    "Reddit story video",
    "AI narration video",
    "TTS video generator",
    "faceless shorts",
    # Features & pain points
    "AI captions tool",
    "animated captions",
    "video caption generator",
    "AI B-roll",
    "auto subtitle",
    "video to shorts",
    "shorts generator",
    "video editing API",
    # Self-hosted / open-source
    "self hosted video editor",
    "open source video clipping",
    "local AI video",
    "self hosted AI tools",
    # Pricing & complaints
    "video tool expensive",
    "video editing subscription",
    "free video clipping",
    "no watermark video editor",
]

FEATURE_KEYWORDS = {
    "clipping": ["clip", "clipping", "cut", "trim", "segment", "highlight", "moment"],
    "captions": ["caption", "subtitle", "transcri", "srt", "word-by-word", "karaoke"],
    "b-roll": ["b-roll", "broll", "b roll", "stock footage", "stock video", "pexels"],
    "faceless": ["faceless", "no face", "reddit story", "tts video", "ai narration"],
    "reframe": ["reframe", "resize", "aspect ratio", "vertical", "9:16", "portrait"],
    "scheduling": ["schedule", "auto-post", "publish", "multi-platform", "cross-post"],
    "brand": ["brand kit", "brand template", "logo", "watermark", "intro", "outro"],
    "voice": ["voice clone", "tts", "text to speech", "voiceover", "narration", "elevenlabs"],
    "dubbing": ["dub", "dubbing", "translate", "translation", "multilingual", "lip sync"],
    "api": ["api", "webhook", "integration", "zapier", "n8n", "automation", "programmatic"],
    "self_hosted": ["self-host", "selfhost", "docker", "local", "on-premise", "privacy"],
    "pricing": ["expensive", "pricing", "cost", "subscription", "free", "credit", "watermark"],
    "thumbnail": ["thumbnail", "cover image", "click-through", "ctr"],
    "music": ["music", "background music", "soundtrack", "audio", "sound effect"],
    "batch": ["batch", "bulk", "multiple videos", "mass", "spreadsheet", "csv"],
    "mobile": ["mobile", "ios", "android", "phone", "app"],
    "collaboration": ["team", "collaboration", "workspace", "share", "multi-user"],
    "analytics": ["analytics", "performance", "metrics", "views", "engagement"],
    "ai_quality": ["accuracy", "context", "joke", "sarcasm", "nuance", "smart"],
    "export": ["export", "premiere", "davinci", "final cut", "xml", "timeline"],
}

SENTIMENT_KEYWORDS = {
    "positive": ["love", "great", "amazing", "best", "perfect", "excellent", "recommend", "awesome", "fantastic", "solved"],
    "negative": ["hate", "terrible", "awful", "worst", "scam", "broken", "useless", "waste", "garbage", "disappointed", "frustrat"],
    "feature_request": ["wish", "would be nice", "should add", "need", "want", "missing", "please add", "feature request", "hope they add"],
    "complaint": ["bug", "crash", "stuck", "error", "doesn't work", "won't", "can't", "broken", "failed", "issue"],
}


def create_reddit_client() -> praw.Reddit:
    """Create authenticated Reddit client from environment variables."""
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    user_agent = os.environ.get("REDDIT_USER_AGENT", "VideoAPIResearch/1.0 (by /u/research_bot)")

    if not client_id or not client_secret:
        print("=" * 60)
        print("Reddit API credentials not found!")
        print()
        print("To set up:")
        print("  1. Go to https://www.reddit.com/prefs/apps")
        print("  2. Click 'create another app'")
        print("  3. Select 'script', fill in name")
        print("  4. Set redirect URI to http://localhost:8080")
        print("  5. Copy the client_id and client_secret")
        print()
        print("Then set environment variables:")
        print('  export REDDIT_CLIENT_ID="your_id"')
        print('  export REDDIT_CLIENT_SECRET="your_secret"')
        print("=" * 60)
        sys.exit(1)

    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )


def classify_features(text: str) -> list[str]:
    """Classify a post's text into feature categories based on keyword matching."""
    text_lower = text.lower()
    matched = []
    for category, keywords in FEATURE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                matched.append(category)
                break
    return matched


def classify_sentiment(text: str) -> dict:
    """Simple keyword-based sentiment classification."""
    text_lower = text.lower()
    result = {}
    for sentiment, keywords in SENTIMENT_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text_lower)
        if count > 0:
            result[sentiment] = count
    return result


def scrape_subreddit_posts(reddit: praw.Reddit, subreddit_name: str, limit: int = 100) -> list[dict]:
    """Scrape top and hot posts from a subreddit."""
    posts = []
    try:
        subreddit = reddit.subreddit(subreddit_name)
        # Scrape from multiple sort orders
        for sort_method in ["hot", "top", "new"]:
            try:
                if sort_method == "hot":
                    submissions = subreddit.hot(limit=limit)
                elif sort_method == "top":
                    submissions = subreddit.top(time_filter="year", limit=limit)
                else:
                    submissions = subreddit.new(limit=limit)

                for submission in submissions:
                    post = extract_post_data(submission, subreddit_name, sort_method)
                    if post:
                        posts.append(post)

            except prawcore.exceptions.Forbidden:
                print(f"  [SKIP] r/{subreddit_name} ({sort_method}): Forbidden")
            except prawcore.exceptions.NotFound:
                print(f"  [SKIP] r/{subreddit_name} ({sort_method}): Not Found")

    except Exception as e:
        print(f"  [ERROR] r/{subreddit_name}: {e}")

    return posts


def scrape_search_results(reddit: praw.Reddit, query: str, limit: int = 50) -> list[dict]:
    """Search Reddit for a specific query across all subreddits."""
    posts = []
    try:
        results = reddit.subreddit("all").search(query, sort="relevance", time_filter="year", limit=limit)
        for submission in results:
            post = extract_post_data(submission, submission.subreddit.display_name, f"search:{query}")
            if post:
                posts.append(post)
    except Exception as e:
        print(f"  [ERROR] Search '{query}': {e}")
    return posts


def extract_post_data(submission, subreddit_name: str, source: str) -> dict | None:
    """Extract structured data from a Reddit submission."""
    try:
        text = f"{submission.title} {submission.selftext}"
        features = classify_features(text)
        sentiment = classify_sentiment(text)

        # Get top comments
        top_comments = []
        try:
            submission.comments.replace_more(limit=0)
            for comment in submission.comments[:10]:
                if hasattr(comment, "body"):
                    comment_features = classify_features(comment.body)
                    comment_sentiment = classify_sentiment(comment.body)
                    top_comments.append({
                        "body": comment.body[:1000],
                        "score": comment.score,
                        "features_mentioned": comment_features,
                        "sentiment": comment_sentiment,
                    })
        except Exception:
            pass

        return {
            "id": submission.id,
            "subreddit": subreddit_name,
            "source": source,
            "title": submission.title,
            "selftext": submission.selftext[:3000] if submission.selftext else "",
            "score": submission.score,
            "num_comments": submission.num_comments,
            "url": f"https://reddit.com{submission.permalink}",
            "created_utc": datetime.fromtimestamp(submission.created_utc, tz=timezone.utc).isoformat(),
            "author": str(submission.author) if submission.author else "[deleted]",
            "features_mentioned": features,
            "sentiment": sentiment,
            "top_comments": top_comments,
        }
    except Exception as e:
        print(f"  [WARN] Failed to extract post: {e}")
        return None


def deduplicate_posts(posts: list[dict]) -> list[dict]:
    """Remove duplicate posts by ID."""
    seen = set()
    unique = []
    for post in posts:
        if post["id"] not in seen:
            seen.add(post["id"])
            unique.append(post)
    return unique


def analyze_results(posts: list[dict]) -> dict:
    """Analyze collected posts for insights."""
    analysis = {
        "total_posts": len(posts),
        "subreddit_distribution": {},
        "feature_frequency": {},
        "sentiment_summary": {"positive": 0, "negative": 0, "feature_request": 0, "complaint": 0},
        "top_posts_by_score": [],
        "top_feature_requests": [],
        "top_complaints": [],
        "tools_mentioned": {},
    }

    # Count subreddit distribution
    for post in posts:
        sub = post["subreddit"]
        analysis["subreddit_distribution"][sub] = analysis["subreddit_distribution"].get(sub, 0) + 1

    # Count feature mentions
    for post in posts:
        for feature in post["features_mentioned"]:
            analysis["feature_frequency"][feature] = analysis["feature_frequency"].get(feature, 0) + 1
        # Also count from comments
        for comment in post.get("top_comments", []):
            for feature in comment.get("features_mentioned", []):
                analysis["feature_frequency"][feature] = analysis["feature_frequency"].get(feature, 0) + 1

    # Sort feature frequency
    analysis["feature_frequency"] = dict(
        sorted(analysis["feature_frequency"].items(), key=lambda x: x[1], reverse=True)
    )

    # Aggregate sentiment
    for post in posts:
        for sentiment, count in post.get("sentiment", {}).items():
            analysis["sentiment_summary"][sentiment] = analysis["sentiment_summary"].get(sentiment, 0) + count

    # Top posts by score
    sorted_by_score = sorted(posts, key=lambda x: x["score"], reverse=True)
    analysis["top_posts_by_score"] = [
        {"title": p["title"], "score": p["score"], "subreddit": p["subreddit"], "url": p["url"]}
        for p in sorted_by_score[:20]
    ]

    # Top feature requests (posts with feature_request sentiment, sorted by score)
    feature_requests = [p for p in posts if "feature_request" in p.get("sentiment", {})]
    feature_requests.sort(key=lambda x: x["score"], reverse=True)
    analysis["top_feature_requests"] = [
        {"title": p["title"], "score": p["score"], "features": p["features_mentioned"], "url": p["url"]}
        for p in feature_requests[:20]
    ]

    # Top complaints
    complaints = [p for p in posts if "complaint" in p.get("sentiment", {})]
    complaints.sort(key=lambda x: x["score"], reverse=True)
    analysis["top_complaints"] = [
        {"title": p["title"], "score": p["score"], "features": p["features_mentioned"], "url": p["url"]}
        for p in complaints[:20]
    ]

    # Tool mentions
    tools = [
        "opusclip", "opus clip", "kapwing", "descript", "submagic", "vizard",
        "klap", "capcut", "captions app", "pictory", "lumen5", "invideo",
        "munch", "runway", "veed", "gling", "autopod", "repurpose",
        "2short", "predis", "shorts generator", "canva",
    ]
    for post in posts:
        text = f"{post['title']} {post['selftext']}".lower()
        for tool in tools:
            if tool in text:
                clean_name = tool.replace(" ", "").title()
                analysis["tools_mentioned"][clean_name] = analysis["tools_mentioned"].get(clean_name, 0) + 1

    analysis["tools_mentioned"] = dict(
        sorted(analysis["tools_mentioned"].items(), key=lambda x: x[1], reverse=True)
    )

    return analysis


def generate_report(analysis: dict, output_path: Path) -> str:
    """Generate a markdown report from the analysis."""
    report = []
    report.append("# Reddit Community Research Report")
    report.append(f"\n**Generated:** {datetime.now(tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    report.append(f"\n**Total Posts Analyzed:** {analysis['total_posts']}")

    report.append("\n## Feature Demand (Most Mentioned)")
    report.append("\n| Rank | Feature | Mentions |")
    report.append("|------|---------|----------|")
    for i, (feature, count) in enumerate(analysis["feature_frequency"].items(), 1):
        report.append(f"| {i} | {feature.replace('_', ' ').title()} | {count} |")

    report.append("\n## Sentiment Summary")
    report.append("\n| Sentiment | Count |")
    report.append("|-----------|-------|")
    for sentiment, count in analysis["sentiment_summary"].items():
        report.append(f"| {sentiment.replace('_', ' ').title()} | {count} |")

    report.append("\n## Tools Most Discussed")
    report.append("\n| Tool | Mentions |")
    report.append("|------|----------|")
    for tool, count in analysis["tools_mentioned"].items():
        report.append(f"| {tool} | {count} |")

    report.append("\n## Subreddit Distribution")
    report.append("\n| Subreddit | Posts |")
    report.append("|-----------|-------|")
    sorted_subs = sorted(analysis["subreddit_distribution"].items(), key=lambda x: x[1], reverse=True)
    for sub, count in sorted_subs:
        report.append(f"| r/{sub} | {count} |")

    report.append("\n## Top Posts by Score")
    for i, post in enumerate(analysis["top_posts_by_score"][:15], 1):
        report.append(f"\n### {i}. [{post['title']}]({post['url']})")
        report.append(f"- **Score:** {post['score']} | **Subreddit:** r/{post['subreddit']}")

    report.append("\n## Top Feature Requests")
    for i, post in enumerate(analysis["top_feature_requests"][:10], 1):
        report.append(f"\n### {i}. [{post['title']}]({post['url']})")
        report.append(f"- **Score:** {post['score']} | **Features:** {', '.join(post['features'])}")

    report.append("\n## Top Complaints")
    for i, post in enumerate(analysis["top_complaints"][:10], 1):
        report.append(f"\n### {i}. [{post['title']}]({post['url']})")
        report.append(f"- **Score:** {post['score']} | **Features:** {', '.join(post['features'])}")

    return "\n".join(report)


def main():
    parser = argparse.ArgumentParser(description="Scrape Reddit for video tool feature requests")
    parser.add_argument("--output", type=str, default="./data/reddit_scrape.json", help="Output JSON file path")
    parser.add_argument("--report", type=str, default="./data/reddit_report.md", help="Output markdown report path")
    parser.add_argument("--limit", type=int, default=100, help="Max posts per subreddit/query")
    parser.add_argument("--search-limit", type=int, default=50, help="Max results per search query")
    parser.add_argument("--skip-subreddits", action="store_true", help="Skip subreddit scraping, only do searches")
    parser.add_argument("--skip-search", action="store_true", help="Skip search queries, only scrape subreddits")
    parser.add_argument("--csv", action="store_true", help="Also export as CSV (requires pandas)")
    args = parser.parse_args()

    output_path = Path(args.output)
    report_path = Path(args.report)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)

    print("Connecting to Reddit API...")
    reddit = create_reddit_client()

    all_posts = []

    # Phase 1: Scrape targeted subreddits
    if not args.skip_subreddits:
        print(f"\nPhase 1: Scraping {len(TARGET_SUBREDDITS)} subreddits...")
        for i, subreddit in enumerate(TARGET_SUBREDDITS, 1):
            print(f"  [{i}/{len(TARGET_SUBREDDITS)}] r/{subreddit}...", end=" ", flush=True)
            posts = scrape_subreddit_posts(reddit, subreddit, limit=args.limit)
            print(f"{len(posts)} posts")
            all_posts.extend(posts)
            time.sleep(1)  # Rate limiting

    # Phase 2: Search queries
    if not args.skip_search:
        print(f"\nPhase 2: Running {len(SEARCH_QUERIES)} search queries...")
        for i, query in enumerate(SEARCH_QUERIES, 1):
            print(f"  [{i}/{len(SEARCH_QUERIES)}] \"{query}\"...", end=" ", flush=True)
            posts = scrape_search_results(reddit, query, limit=args.search_limit)
            print(f"{len(posts)} results")
            all_posts.extend(posts)
            time.sleep(1)  # Rate limiting

    # Deduplicate
    print(f"\nDeduplicating {len(all_posts)} total posts...")
    unique_posts = deduplicate_posts(all_posts)
    print(f"  {len(unique_posts)} unique posts after deduplication")

    # Save raw data
    print(f"\nSaving raw data to {output_path}...")
    with open(output_path, "w") as f:
        json.dump({"posts": unique_posts, "metadata": {
            "scraped_at": datetime.now(tz=timezone.utc).isoformat(),
            "total_posts": len(unique_posts),
            "subreddits_scraped": TARGET_SUBREDDITS,
            "queries_used": SEARCH_QUERIES,
        }}, f, indent=2, default=str)

    # Analyze
    print("Analyzing results...")
    analysis = analyze_results(unique_posts)

    # Save analysis
    analysis_path = output_path.with_name("reddit_analysis.json")
    with open(analysis_path, "w") as f:
        json.dump(analysis, f, indent=2, default=str)
    print(f"Analysis saved to {analysis_path}")

    # Generate report
    report = generate_report(analysis, report_path)
    with open(report_path, "w") as f:
        f.write(report)
    print(f"Report saved to {report_path}")

    # Optional CSV export
    if args.csv:
        if HAS_PANDAS:
            csv_path = output_path.with_suffix(".csv")
            df = pd.DataFrame([{
                "id": p["id"],
                "subreddit": p["subreddit"],
                "title": p["title"],
                "score": p["score"],
                "num_comments": p["num_comments"],
                "features": ", ".join(p["features_mentioned"]),
                "sentiment": str(p["sentiment"]),
                "url": p["url"],
                "created_utc": p["created_utc"],
            } for p in unique_posts])
            df.to_csv(csv_path, index=False)
            print(f"CSV exported to {csv_path}")
        else:
            print("  [WARN] pandas not installed, skipping CSV export (pip install pandas)")

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total unique posts: {analysis['total_posts']}")
    print(f"\nTop 10 Feature Demands:")
    for i, (feature, count) in enumerate(list(analysis["feature_frequency"].items())[:10], 1):
        print(f"  {i}. {feature.replace('_', ' ').title()}: {count} mentions")
    print(f"\nSentiment Breakdown:")
    for sentiment, count in analysis["sentiment_summary"].items():
        print(f"  {sentiment.replace('_', ' ').title()}: {count}")
    print(f"\nMost Discussed Tools:")
    for tool, count in list(analysis["tools_mentioned"].items())[:10]:
        print(f"  {tool}: {count} mentions")
    print("=" * 60)


if __name__ == "__main__":
    main()
