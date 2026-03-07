import uuid

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, key: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(key, []).append(websocket)

    def disconnect(self, key: str, websocket: WebSocket) -> None:
        if key in self._connections:
            self._connections[key] = [ws for ws in self._connections[key] if ws is not websocket]

    async def send_json(self, key: str, data: dict) -> None:
        for ws in self._connections.get(key, []):
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(key, ws)

    async def broadcast_job_progress(
        self, job_id: uuid.UUID, progress: float, status: str
    ) -> None:
        await self.send_json(
            f"job:{job_id}",
            {"job_id": str(job_id), "progress": progress, "status": status},
        )


ws_manager = ConnectionManager()
