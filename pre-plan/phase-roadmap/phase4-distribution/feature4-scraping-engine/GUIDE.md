# Scraping Engine — Implementation Guide

## Overview
- **What:** Build a stealth web scraping engine using Crawlee (open-source Apify core) + Playwright to extract public data from YouTube, TikTok, Instagram, X, and Reddit. Data includes profiles, posts, engagement metrics, hashtags, and trending content.
- **Why:** Competitor analytics, trending detection, and hashtag analysis all depend on fresh data from social platforms. Official APIs have strict rate limits and limited data access. Web scraping fills the gap for publicly available data that APIs do not expose (e.g., competitor view counts, trending hashtags, audience demographics).
- **Dependencies:** Phase 1 Feature 3 (Celery + Redis job queue), PostgreSQL for storing scraped data, GCS for raw data storage.

## Architecture

### System Design
```
Celery Beat                    Celery Worker (scrape queue)           Crawlee + Playwright
  │                                    │                                     │
  │  Scheduled scrape jobs             │                                     │
  │  (every 6h / 12h / daily)         │                                     │
  │───────────────────────────────────>│                                     │
  │                                    │  Launch Crawlee crawler              │
  │                                    │────────────────────────────────────>│
  │                                    │                                     │  Stealth Playwright
  │                                    │                                     │  browser session
  │                                    │                                     │  ──────────────────>
  │                                    │                                     │  Platform website
  │                                    │     Extracted data                   │
  │                                    │<────────────────────────────────────│
  │                                    │                                     │
  │                                    │  Store in PostgreSQL                │
  │                                    │  (scraped_profiles,                 │
  │                                    │   scraped_posts,                    │
  │                                    │   scraped_metrics)                  │
  │                                    │─────────────────>                   │
```

### Stealth Stack
```
Crawlee (RequestQueue, AutoscaledPool, SessionPool)
  └── PlaywrightCrawler
       └── playwright-extra
            └── stealth plugin (evade bot detection)
                 ├── navigator.webdriver = false
                 ├── chrome.runtime injection
                 ├── WebGL fingerprint randomization
                 ├── timezone/locale matching
                 └── realistic mouse movement + delays

Proxy Rotation:
  └── Residential proxy pool (optional, for production)
  └── Rotating datacenter proxies as fallback
```

## Step-by-Step Implementation

### Step 1: Set Up Crawlee Service

The scraping engine runs as a separate Node.js microservice alongside the Python backend. Celery tasks invoke it via HTTP.

Create `services/scraper/package.json`:
```json
{
  "name": "openclip-scraper",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  },
  "dependencies": {
    "crawlee": "^3.11.0",
    "playwright": "^1.48.0",
    "playwright-extra": "^4.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "winston": "^3.15.0"
  }
}
```

Install:
```bash
cd services/scraper
npm install
npx playwright install chromium
```

### Step 2: Stealth Playwright Configuration

Create `services/scraper/src/browser.js`:
```javascript
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Apply stealth plugin to evade bot detection
chromium.use(StealthPlugin());

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
];

export function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function createStealthBrowser(options = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-infobars",
      "--window-position=0,0",
      "--ignore-certificate-errors",
      "--ignore-certificate-errors-spki-list",
    ],
    ...(options.proxy ? { proxy: options.proxy } : {}),
  });

  return browser;
}

export async function createStealthContext(browser) {
  const userAgent = getRandomElement(USER_AGENTS);
  const viewport = getRandomElement(VIEWPORTS);

  const context = await browser.newContext({
    userAgent,
    viewport,
    locale: "en-US",
    timezoneId: "America/New_York",
    geolocation: { latitude: 40.7128, longitude: -74.0060 },
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
  });

  return context;
}

/**
 * Add human-like delays between actions.
 */
export function humanDelay(min = 1000, max = 3000) {
  return new Promise((resolve) =>
    setTimeout(resolve, Math.floor(Math.random() * (max - min) + min))
  );
}
```

### Step 3: Platform Crawlers

Create `services/scraper/src/crawlers/youtube.js`:
```javascript
import { PlaywrightCrawler, Dataset } from "crawlee";
import { createStealthBrowser, createStealthContext, humanDelay } from "../browser.js";
import { logger } from "../logger.js";

export async function scrapeYouTubeChannel(channelUrl, options = {}) {
  const maxVideos = options.maxVideos || 30;
  const results = { profile: null, videos: [] };

  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    // Navigate to channel
    await page.goto(channelUrl, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(2000, 4000);

    // Extract channel profile
    results.profile = await page.evaluate(() => {
      const name = document.querySelector("#channel-name #text")?.textContent?.trim();
      const handle = document.querySelector("#channel-handle")?.textContent?.trim();
      const subscriberText = document.querySelector("#subscriber-count")?.textContent?.trim();
      const avatar = document.querySelector("#avatar img")?.src;
      const banner = document.querySelector("#banner img")?.src;
      const description = document.querySelector("#description-container")?.textContent?.trim();

      return {
        name,
        handle,
        subscriber_count_text: subscriberText,
        avatar_url: avatar,
        banner_url: banner,
        description: description?.substring(0, 500),
      };
    });

    // Navigate to videos tab
    await page.goto(`${channelUrl}/videos`, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(2000, 3000);

    // Scroll to load more videos
    let lastHeight = 0;
    let scrollAttempts = 0;
    while (results.videos.length < maxVideos && scrollAttempts < 10) {
      const videos = await page.evaluate(() => {
        const items = document.querySelectorAll("ytd-rich-item-renderer, ytd-grid-video-renderer");
        return Array.from(items).map((item) => {
          const titleEl = item.querySelector("#video-title");
          const viewsEl = item.querySelector("#metadata-line span:first-child");
          const dateEl = item.querySelector("#metadata-line span:nth-child(2)");
          const thumbnailEl = item.querySelector("img");
          const linkEl = item.querySelector("a#thumbnail");
          const durationEl = item.querySelector("ytd-thumbnail-overlay-time-status-renderer span");

          return {
            title: titleEl?.textContent?.trim(),
            url: linkEl?.href,
            video_id: linkEl?.href?.match(/v=([^&]+)/)?.[1],
            views_text: viewsEl?.textContent?.trim(),
            published_text: dateEl?.textContent?.trim(),
            thumbnail_url: thumbnailEl?.src,
            duration_text: durationEl?.textContent?.trim(),
          };
        });
      });

      results.videos = videos.slice(0, maxVideos);

      // Scroll down
      await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      await humanDelay(1500, 2500);

      const newHeight = await page.evaluate("document.documentElement.scrollHeight");
      if (newHeight === lastHeight) break;
      lastHeight = newHeight;
      scrollAttempts++;
    }

    logger.info(`Scraped YouTube channel: ${results.profile?.name}, ${results.videos.length} videos`);

  } catch (error) {
    logger.error(`YouTube scrape failed: ${error.message}`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}

export async function scrapeYouTubeVideo(videoUrl) {
  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(videoUrl, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(3000, 5000);

    const videoData = await page.evaluate(() => {
      const title = document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim();
      const viewCount = document.querySelector("#info .view-count, ytd-watch-info-text span:first-child")?.textContent?.trim();
      const likeButton = document.querySelector("#top-level-buttons-computed ytd-toggle-button-renderer:first-child #text");
      const likes = likeButton?.getAttribute("aria-label") || likeButton?.textContent?.trim();
      const dateEl = document.querySelector("#info-strings yt-formatted-string");
      const channelName = document.querySelector("#channel-name a")?.textContent?.trim();
      const description = document.querySelector("#description-inline-expander")?.textContent?.trim();

      // Get comments count
      const commentsHeader = document.querySelector("#count .count-text span");
      const commentsCount = commentsHeader?.textContent?.trim();

      return {
        title,
        view_count_text: viewCount,
        like_count_text: likes,
        published_date_text: dateEl?.textContent?.trim(),
        channel_name: channelName,
        description: description?.substring(0, 1000),
        comments_count_text: commentsCount,
      };
    });

    return videoData;

  } finally {
    await context.close();
    await browser.close();
  }
}
```

Create `services/scraper/src/crawlers/tiktok.js`:
```javascript
import { createStealthBrowser, createStealthContext, humanDelay } from "../browser.js";
import { logger } from "../logger.js";

export async function scrapeTikTokProfile(profileUrl, options = {}) {
  const maxVideos = options.maxVideos || 30;
  const results = { profile: null, videos: [] };

  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(profileUrl, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(3000, 5000);

    // Extract profile info
    results.profile = await page.evaluate(() => {
      const name = document.querySelector("[data-e2e='user-subtitle']")?.textContent?.trim();
      const handle = document.querySelector("[data-e2e='user-title']")?.textContent?.trim();
      const avatar = document.querySelector("[data-e2e='user-avatar'] img")?.src;
      const bio = document.querySelector("[data-e2e='user-bio']")?.textContent?.trim();

      const stats = {};
      const statElements = document.querySelectorAll("[data-e2e='following-count'], [data-e2e='followers-count'], [data-e2e='likes-count']");
      statElements.forEach((el) => {
        const key = el.getAttribute("data-e2e");
        stats[key] = el.textContent?.trim();
      });

      return {
        name,
        handle,
        avatar_url: avatar,
        bio: bio?.substring(0, 500),
        following_count: stats["following-count"],
        follower_count: stats["followers-count"],
        like_count: stats["likes-count"],
      };
    });

    // Extract videos
    let scrollAttempts = 0;
    while (results.videos.length < maxVideos && scrollAttempts < 15) {
      const videos = await page.evaluate(() => {
        const items = document.querySelectorAll("[data-e2e='user-post-item']");
        return Array.from(items).map((item) => {
          const link = item.querySelector("a")?.href;
          const views = item.querySelector("strong[data-e2e='video-views']")?.textContent?.trim();
          const thumbnail = item.querySelector("img")?.src;
          const desc = item.querySelector("[data-e2e='video-desc']")?.textContent?.trim();

          return {
            url: link,
            views_text: views,
            thumbnail_url: thumbnail,
            description: desc?.substring(0, 300),
          };
        });
      });

      results.videos = videos.slice(0, maxVideos);

      await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      await humanDelay(2000, 3000);
      scrollAttempts++;
    }

    logger.info(`Scraped TikTok profile: ${results.profile?.handle}, ${results.videos.length} videos`);

  } catch (error) {
    logger.error(`TikTok scrape failed: ${error.message}`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}

export async function scrapeTikTokTrending(options = {}) {
  const maxVideos = options.maxVideos || 50;
  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    await page.goto("https://www.tiktok.com/explore", { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(3000, 5000);

    const trending = await page.evaluate(() => {
      const items = document.querySelectorAll("[data-e2e='explore-item']");
      return Array.from(items).map((item) => {
        const title = item.querySelector("[data-e2e='explore-card-desc']")?.textContent?.trim();
        const link = item.querySelector("a")?.href;
        const views = item.querySelector("[data-e2e='explore-card-views']")?.textContent?.trim();
        return { title, url: link, views_text: views };
      });
    });

    return trending.slice(0, maxVideos);

  } finally {
    await context.close();
    await browser.close();
  }
}
```

Create `services/scraper/src/crawlers/instagram.js`:
```javascript
import { createStealthBrowser, createStealthContext, humanDelay } from "../browser.js";
import { logger } from "../logger.js";

export async function scrapeInstagramProfile(profileUrl, options = {}) {
  const maxPosts = options.maxPosts || 30;
  const results = { profile: null, posts: [] };

  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(profileUrl, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(3000, 5000);

    // Check for login wall and dismiss if possible
    const loginModal = await page.$("[role='dialog'] button");
    if (loginModal) {
      const closeBtn = await page.$("[role='dialog'] [aria-label='Close']");
      if (closeBtn) await closeBtn.click();
      await humanDelay(1000, 2000);
    }

    // Extract profile info
    results.profile = await page.evaluate(() => {
      const name = document.querySelector("header section h2, header h1")?.textContent?.trim();
      const bio = document.querySelector("header section > div > span, header section div.-vDIg span")?.textContent?.trim();
      const avatar = document.querySelector("header img")?.src;

      // Stats: posts, followers, following
      const statElements = document.querySelectorAll("header section ul li span span, header section ul li a span");
      const stats = Array.from(statElements).map((el) => el.textContent?.trim());

      return {
        username: name,
        bio: bio?.substring(0, 500),
        avatar_url: avatar,
        posts_count: stats[0],
        followers_count: stats[1],
        following_count: stats[2],
      };
    });

    // Extract posts (grid items)
    let scrollAttempts = 0;
    while (results.posts.length < maxPosts && scrollAttempts < 10) {
      const posts = await page.evaluate(() => {
        const articles = document.querySelectorAll("article a[href*='/p/'], article a[href*='/reel/']");
        return Array.from(articles).map((el) => {
          const img = el.querySelector("img");
          const link = el.href;

          // Try to get likes/comments from hover overlay
          const likeSpan = el.querySelector("li span");
          const commentSpan = el.querySelectorAll("li span")[1];

          return {
            url: link,
            thumbnail_url: img?.src,
            alt_text: img?.alt,
            likes_text: likeSpan?.textContent?.trim(),
            comments_text: commentSpan?.textContent?.trim(),
          };
        });
      });

      results.posts = posts.slice(0, maxPosts);

      await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      await humanDelay(2000, 4000);
      scrollAttempts++;
    }

    logger.info(`Scraped Instagram profile: ${results.profile?.username}, ${results.posts.length} posts`);

  } catch (error) {
    logger.error(`Instagram scrape failed: ${error.message}`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}
```

Create `services/scraper/src/crawlers/x.js`:
```javascript
import { createStealthBrowser, createStealthContext, humanDelay } from "../browser.js";
import { logger } from "../logger.js";

export async function scrapeXProfile(profileUrl, options = {}) {
  const maxTweets = options.maxTweets || 30;
  const results = { profile: null, tweets: [] };

  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    await page.goto(profileUrl, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(3000, 5000);

    results.profile = await page.evaluate(() => {
      const name = document.querySelector("[data-testid='UserName'] span span")?.textContent?.trim();
      const handle = document.querySelector("[data-testid='UserName'] div:nth-child(2) span")?.textContent?.trim();
      const bio = document.querySelector("[data-testid='UserDescription']")?.textContent?.trim();
      const avatar = document.querySelector("[data-testid='UserAvatar'] img")?.src;

      const followingEl = document.querySelector("a[href$='/following'] span span");
      const followersEl = document.querySelector("a[href$='/verified_followers'] span span, a[href$='/followers'] span span");

      return {
        name,
        handle,
        bio: bio?.substring(0, 500),
        avatar_url: avatar,
        following_count: followingEl?.textContent?.trim(),
        followers_count: followersEl?.textContent?.trim(),
      };
    });

    // Scroll to load tweets
    let scrollAttempts = 0;
    while (results.tweets.length < maxTweets && scrollAttempts < 15) {
      const tweets = await page.evaluate(() => {
        const articles = document.querySelectorAll("article[data-testid='tweet']");
        return Array.from(articles).map((article) => {
          const textEl = article.querySelector("[data-testid='tweetText']");
          const timeEl = article.querySelector("time");
          const linkEl = article.querySelector("a[href*='/status/']");

          // Engagement metrics
          const replyEl = article.querySelector("[data-testid='reply'] span");
          const retweetEl = article.querySelector("[data-testid='retweet'] span");
          const likeEl = article.querySelector("[data-testid='like'] span");
          const viewEl = article.querySelector("a[href*='/analytics'] span, [data-testid='app-text-transition-container'] span");

          return {
            text: textEl?.textContent?.trim()?.substring(0, 500),
            url: linkEl?.href,
            published_at: timeEl?.getAttribute("datetime"),
            reply_count: replyEl?.textContent?.trim(),
            retweet_count: retweetEl?.textContent?.trim(),
            like_count: likeEl?.textContent?.trim(),
            view_count: viewEl?.textContent?.trim(),
          };
        });
      });

      results.tweets = tweets.slice(0, maxTweets);

      await page.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
      await humanDelay(1500, 2500);
      scrollAttempts++;
    }

    logger.info(`Scraped X profile: ${results.profile?.handle}, ${results.tweets.length} tweets`);

  } catch (error) {
    logger.error(`X scrape failed: ${error.message}`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}
```

Create `services/scraper/src/crawlers/reddit.js`:
```javascript
import { createStealthBrowser, createStealthContext, humanDelay } from "../browser.js";
import { logger } from "../logger.js";

export async function scrapeRedditSubreddit(subredditUrl, options = {}) {
  const maxPosts = options.maxPosts || 50;
  const sortBy = options.sortBy || "hot"; // hot, new, top
  const results = { subreddit: null, posts: [] };

  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  try {
    const url = subredditUrl.endsWith("/") ? subredditUrl + sortBy : `${subredditUrl}/${sortBy}`;
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(2000, 4000);

    // Use old.reddit.com for easier scraping (structured HTML)
    const oldUrl = url.replace("www.reddit.com", "old.reddit.com");
    await page.goto(oldUrl, { waitUntil: "networkidle", timeout: 30000 });
    await humanDelay(2000, 3000);

    results.subreddit = await page.evaluate(() => {
      const name = document.querySelector(".redditname a")?.textContent?.trim();
      const subscribers = document.querySelector(".subscribers .number")?.textContent?.trim();
      const description = document.querySelector(".md p")?.textContent?.trim();
      return { name, subscribers, description: description?.substring(0, 500) };
    });

    results.posts = await page.evaluate((max) => {
      const items = document.querySelectorAll(".thing.link");
      return Array.from(items).slice(0, max).map((item) => {
        const title = item.querySelector("a.title")?.textContent?.trim();
        const link = item.querySelector("a.title")?.href;
        const score = item.querySelector(".score.unvoted")?.textContent?.trim();
        const comments = item.querySelector(".comments")?.textContent?.trim();
        const author = item.querySelector(".author")?.textContent?.trim();
        const time = item.querySelector("time")?.getAttribute("datetime");
        const domain = item.querySelector(".domain a")?.textContent?.trim();

        return { title, url: link, score, comments_text: comments, author, published_at: time, domain };
      });
    }, maxPosts);

    logger.info(`Scraped Reddit: ${results.subreddit?.name}, ${results.posts.length} posts`);

  } catch (error) {
    logger.error(`Reddit scrape failed: ${error.message}`);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}
```

### Step 4: Scraper HTTP Service

Create `services/scraper/src/logger.js`:
```javascript
import winston from "winston";

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});
```

Create `services/scraper/src/server.js`:
```javascript
import express from "express";
import cors from "cors";
import { logger } from "./logger.js";
import { scrapeYouTubeChannel, scrapeYouTubeVideo } from "./crawlers/youtube.js";
import { scrapeTikTokProfile, scrapeTikTokTrending } from "./crawlers/tiktok.js";
import { scrapeInstagramProfile } from "./crawlers/instagram.js";
import { scrapeXProfile } from "./crawlers/x.js";
import { scrapeRedditSubreddit } from "./crawlers/reddit.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.SCRAPER_PORT || 8010;

// Rate limiting: track active scrapes per platform
const activeScrapes = new Map();
const MAX_CONCURRENT_PER_PLATFORM = 2;

function checkRateLimit(platform) {
  const count = activeScrapes.get(platform) || 0;
  if (count >= MAX_CONCURRENT_PER_PLATFORM) {
    return false;
  }
  activeScrapes.set(platform, count + 1);
  return true;
}

function releaseRateLimit(platform) {
  const count = activeScrapes.get(platform) || 1;
  activeScrapes.set(platform, Math.max(0, count - 1));
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", active_scrapes: Object.fromEntries(activeScrapes) });
});

// YouTube
app.post("/scrape/youtube/channel", async (req, res) => {
  const { url, max_videos } = req.body;
  if (!checkRateLimit("youtube")) return res.status(429).json({ error: "Rate limited" });

  try {
    const result = await scrapeYouTubeChannel(url, { maxVideos: max_videos || 30 });
    res.json(result);
  } catch (error) {
    logger.error("YouTube channel scrape failed", { error: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    releaseRateLimit("youtube");
  }
});

app.post("/scrape/youtube/video", async (req, res) => {
  const { url } = req.body;
  if (!checkRateLimit("youtube")) return res.status(429).json({ error: "Rate limited" });

  try {
    const result = await scrapeYouTubeVideo(url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    releaseRateLimit("youtube");
  }
});

// TikTok
app.post("/scrape/tiktok/profile", async (req, res) => {
  const { url, max_videos } = req.body;
  if (!checkRateLimit("tiktok")) return res.status(429).json({ error: "Rate limited" });

  try {
    const result = await scrapeTikTokProfile(url, { maxVideos: max_videos || 30 });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    releaseRateLimit("tiktok");
  }
});

app.post("/scrape/tiktok/trending", async (req, res) => {
  const { max_videos } = req.body;
  if (!checkRateLimit("tiktok")) return res.status(429).json({ error: "Rate limited" });

  try {
    const result = await scrapeTikTokTrending({ maxVideos: max_videos || 50 });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    releaseRateLimit("tiktok");
  }
});

// Instagram
app.post("/scrape/instagram/profile", async (req, res) => {
  const { url, max_posts } = req.body;
  if (!checkRateLimit("instagram")) return res.status(429).json({ error: "Rate limited" });

  try {
    const result = await scrapeInstagramProfile(url, { maxPosts: max_posts || 30 });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    releaseRateLimit("instagram");
  }
});

// X (Twitter)
app.post("/scrape/x/profile", async (req, res) => {
  const { url, max_tweets } = req.body;
  if (!checkRateLimit("x")) return res.status(429).json({ error: "Rate limited" });

  try {
    const result = await scrapeXProfile(url, { maxTweets: max_tweets || 30 });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    releaseRateLimit("x");
  }
});

// Reddit
app.post("/scrape/reddit/subreddit", async (req, res) => {
  const { url, max_posts, sort_by } = req.body;
  if (!checkRateLimit("reddit")) return res.status(429).json({ error: "Rate limited" });

  try {
    const result = await scrapeRedditSubreddit(url, { maxPosts: max_posts || 50, sortBy: sort_by || "hot" });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    releaseRateLimit("reddit");
  }
});

app.listen(PORT, () => {
  logger.info(`Scraper service listening on port ${PORT}`);
});
```

### Step 5: Database Models for Scraped Data

Create `backend/app/models/scraped_data.py`:
```python
from datetime import datetime

from sqlalchemy import String, Integer, Float, JSON, Text, DateTime, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ScrapedProfile(BaseModel):
    __tablename__ = "scraped_profiles"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    profile_url: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    follower_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    following_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    post_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    last_scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ScrapedPost(BaseModel):
    __tablename__ = "scraped_posts"

    scraped_profile_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scraped_profiles.id"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    platform_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    post_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    view_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    like_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    comment_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    share_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ScrapedMetricSnapshot(BaseModel):
    """Time-series engagement metrics — one row per profile per scrape."""
    __tablename__ = "scraped_metric_snapshots"

    scraped_profile_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scraped_profiles.id"), nullable=False, index=True
    )
    follower_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    post_count: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_views: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    total_likes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    avg_engagement_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    scraped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
```

### Step 6: Celery Scrape Tasks

Create `backend/app/tasks/scrape.py`:
```python
import asyncio
from datetime import datetime, timezone

import httpx
import structlog
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_sync_session
from app.models.scraped_data import ScrapedProfile, ScrapedPost, ScrapedMetricSnapshot
from app.worker import celery_app

logger = structlog.get_logger()

SCRAPER_URL = settings.SCRAPER_URL or "http://localhost:8010"


def _parse_count(text: str | None) -> int | None:
    """Parse human-readable counts like '1.2M', '500K', '1,234' to integers."""
    if not text:
        return None
    text = text.strip().replace(",", "").replace(" ", "")
    multipliers = {"K": 1_000, "M": 1_000_000, "B": 1_000_000_000}
    for suffix, mult in multipliers.items():
        if text.upper().endswith(suffix):
            try:
                return int(float(text[:-1]) * mult)
            except ValueError:
                return None
    try:
        return int(text)
    except ValueError:
        return None


@celery_app.task(name="app.tasks.scrape.scrape_profile", bind=True, max_retries=2)
def scrape_profile(self, scraped_profile_id: str):
    """Scrape a single tracked profile and store results."""
    with get_sync_session() as db:
        profile = db.execute(
            select(ScrapedProfile).where(ScrapedProfile.id == scraped_profile_id)
        ).scalar_one_or_none()

        if not profile:
            logger.error("scrape_profile_not_found", id=scraped_profile_id)
            return

        platform = profile.platform
        url = profile.profile_url

        # Map platform to scraper endpoint
        endpoint_map = {
            "youtube": "/scrape/youtube/channel",
            "tiktok": "/scrape/tiktok/profile",
            "instagram": "/scrape/instagram/profile",
            "x": "/scrape/x/profile",
        }

        endpoint = endpoint_map.get(platform)
        if not endpoint:
            logger.error("unsupported_platform", platform=platform)
            return

        try:
            # Call scraper microservice
            response = httpx.post(
                f"{SCRAPER_URL}{endpoint}",
                json={"url": url, "max_videos": 30, "max_posts": 30, "max_tweets": 30},
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()

            now = datetime.now(timezone.utc)

            # Update profile info
            profile_data = data.get("profile", {})
            if profile_data:
                profile.display_name = profile_data.get("name") or profile_data.get("username")
                profile.username = profile_data.get("handle") or profile_data.get("username")
                profile.avatar_url = profile_data.get("avatar_url")
                profile.bio = profile_data.get("bio") or profile_data.get("description")
                profile.follower_count = _parse_count(
                    profile_data.get("subscriber_count_text")
                    or profile_data.get("follower_count")
                    or profile_data.get("followers_count")
                )
                profile.following_count = _parse_count(profile_data.get("following_count"))
                profile.raw_data = profile_data
                profile.last_scraped_at = now

            # Store posts
            posts_data = data.get("videos") or data.get("posts") or data.get("tweets") or []
            for post_data in posts_data:
                scraped_post = ScrapedPost(
                    scraped_profile_id=profile.id,
                    platform=platform,
                    post_url=post_data.get("url"),
                    title=post_data.get("title"),
                    description=post_data.get("description") or post_data.get("text"),
                    thumbnail_url=post_data.get("thumbnail_url"),
                    view_count=_parse_count(post_data.get("views_text") or post_data.get("view_count")),
                    like_count=_parse_count(post_data.get("like_count")),
                    comment_count=_parse_count(post_data.get("comments_count_text") or post_data.get("comments_text")),
                    share_count=_parse_count(post_data.get("retweet_count")),
                    scraped_at=now,
                    raw_data=post_data,
                )
                db.add(scraped_post)

            # Store metric snapshot for time-series tracking
            total_views = sum(p.view_count or 0 for p in [scraped_post] if hasattr(scraped_post, 'view_count'))
            snapshot = ScrapedMetricSnapshot(
                scraped_profile_id=profile.id,
                follower_count=profile.follower_count,
                post_count=len(posts_data),
                scraped_at=now,
            )
            db.add(snapshot)

            db.commit()
            logger.info("scrape_success", profile_id=scraped_profile_id, platform=platform, posts=len(posts_data))

        except Exception as e:
            logger.error("scrape_failed", profile_id=scraped_profile_id, error=str(e))
            raise self.retry(exc=e)


@celery_app.task(name="app.tasks.scrape.scrape_all_tracked_profiles")
def scrape_all_tracked_profiles():
    """Celery Beat: scrape all tracked profiles. Dispatches individual scrape tasks."""
    with get_sync_session() as db:
        profiles = db.execute(select(ScrapedProfile)).scalars().all()
        for profile in profiles:
            scrape_profile.delay(str(profile.id))
        logger.info("scrape_batch_dispatched", count=len(profiles))
```

Add to Celery Beat schedule in `backend/app/worker.py`:
```python
celery_app.conf.beat_schedule.update({
    "scrape-all-tracked-profiles": {
        "task": "app.tasks.scrape.scrape_all_tracked_profiles",
        "schedule": crontab(hour="*/6"),  # Every 6 hours
    },
})
```

### Step 7: Docker Configuration

Create `services/scraper/Dockerfile`:
```dockerfile
FROM node:20-slim

# Install Playwright dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
RUN npx playwright install chromium

COPY src/ ./src/

ENV NODE_ENV=production
ENV SCRAPER_PORT=8010
EXPOSE 8010

CMD ["node", "src/server.js"]
```

Add to `docker/docker-compose.yml`:
```yaml
  scraper:
    build: ../services/scraper
    ports:
      - "8010:8010"
    environment:
      - SCRAPER_PORT=8010
      - NODE_ENV=production
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
```

## Best Practices
- **Respectful scraping:** Add 1-5 second delays between requests. Limit to 2 concurrent scrapes per platform. Honor robots.txt for non-essential pages.
- **Stealth measures:** Use `playwright-extra` with stealth plugin. Rotate user agents and viewports. Match timezone/locale to geolocation.
- **Error resilience:** Scraped selectors break frequently when platforms update their UI. Log raw HTML on failure for debugging. Use multiple selector fallbacks.
- **Data freshness:** Scrape every 6 hours for active competitors, every 24 hours for passive tracking. Store time-series snapshots for trend analysis.
- **Proxy rotation:** For production at scale, use a residential proxy pool to avoid IP bans. Start with datacenter proxies for development.
- **Legal compliance:** Only scrape publicly available data. Do not scrape behind login walls. Do not violate platform ToS for commercial purposes. Provide opt-out mechanism.

## Testing
- Run the scraper service: `cd services/scraper && npm run dev`
- Test YouTube: `curl -X POST http://localhost:8010/scrape/youtube/channel -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/@MrBeast"}'`
- Test TikTok: `curl -X POST http://localhost:8010/scrape/tiktok/profile -H "Content-Type: application/json" -d '{"url":"https://www.tiktok.com/@khaby.lame"}'`
- Verify data is stored in `scraped_profiles`, `scraped_posts`, and `scraped_metric_snapshots` tables.

## Verification Checklist
- [ ] Scraper Node.js service starts and responds on `/health`
- [ ] YouTube channel scraper extracts profile and videos
- [ ] TikTok profile scraper extracts profile and videos
- [ ] Instagram profile scraper extracts profile and posts
- [ ] X profile scraper extracts profile and tweets
- [ ] Reddit subreddit scraper extracts posts
- [ ] Stealth plugin active (bot detection not triggered)
- [ ] Human-like delays between requests (1-5 seconds)
- [ ] Rate limiting: max 2 concurrent scrapes per platform
- [ ] Scraped data stored in PostgreSQL (profiles, posts, metric snapshots)
- [ ] Celery Beat dispatches scrape jobs every 6 hours
- [ ] Individual scrape tasks retry up to 2 times on failure
- [ ] Count parsing works for "1.2M", "500K", "1,234" formats
- [ ] Docker container runs with Playwright Chromium
