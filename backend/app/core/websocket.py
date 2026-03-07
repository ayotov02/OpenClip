import asyncio
import json
import logging
import uuid

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket connection manager backed by Redis pub/sub.

    Local connections are tracked in-memory per instance. Job progress
    updates are published to Redis channels so that any API instance
    can deliver updates to connected clients.
    """

    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}
        self._pubsub = None
        self._listener_task: asyncio.Task | None = None

    async def _get_redis(self):
        from app.core.redis import get_redis

        return await get_redis()

    async def start_listener(self) -> None:
        """Start background task to listen for Redis pub/sub messages."""
        if self._listener_task is not None:
            return
        redis = await self._get_redis()
        self._pubsub = redis.pubsub()
        await self._pubsub.psubscribe("ws:*")
        self._listener_task = asyncio.create_task(self._listen())

    async def stop_listener(self) -> None:
        """Stop the Redis pub/sub listener."""
        if self._listener_task:
            self._listener_task.cancel()
            self._listener_task = None
        if self._pubsub:
            await self._pubsub.unsubscribe()
            await self._pubsub.close()
            self._pubsub = None

    async def _listen(self) -> None:
        """Background loop: receive Redis pub/sub messages and forward to local WebSocket connections."""
        try:
            async for message in self._pubsub.listen():
                if message["type"] not in ("pmessage",):
                    continue
                channel = message["channel"]
                if isinstance(channel, bytes):
                    channel = channel.decode()
                data_raw = message["data"]
                if isinstance(data_raw, bytes):
                    data_raw = data_raw.decode()
                try:
                    data = json.loads(data_raw)
                except (json.JSONDecodeError, TypeError):
                    continue

                # Channel format: "ws:job:{job_id}" or "ws:user:{user_id}"
                key = channel.removeprefix("ws:")
                await self._send_to_local(key, data)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("WebSocket Redis listener error")

    async def connect(self, key: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(key, []).append(websocket)

    def disconnect(self, key: str, websocket: WebSocket) -> None:
        if key in self._connections:
            self._connections[key] = [
                ws for ws in self._connections[key] if ws is not websocket
            ]
            if not self._connections[key]:
                del self._connections[key]

    async def _send_to_local(self, key: str, data: dict) -> None:
        """Send data to locally-connected WebSockets for the given key."""
        for ws in list(self._connections.get(key, [])):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(key, ws)

    async def publish(self, key: str, data: dict) -> None:
        """Publish a message to Redis pub/sub channel for all instances."""
        redis = await self._get_redis()
        await redis.publish(f"ws:{key}", json.dumps(data))

    async def broadcast_job_progress(
        self, job_id: uuid.UUID, progress: float, status: str
    ) -> None:
        """Publish job progress update via Redis pub/sub."""
        await self.publish(
            f"job:{job_id}",
            {"job_id": str(job_id), "progress": progress, "status": status},
        )


ws_manager = ConnectionManager()
