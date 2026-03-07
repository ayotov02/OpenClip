import time

from fastapi import HTTPException, Request, status

from app.core.redis import get_redis


async def rate_limit(request: Request, limit: int = 60, window: int = 60) -> None:
    """Sliding window rate limiter using Redis."""
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:{client_ip}:{request.url.path}"
    redis = await get_redis()
    now = time.time()
    pipe = redis.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window)
    results = await pipe.execute()
    count = results[2]
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )
