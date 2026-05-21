"""In-process SSE event bus for space-scoped realtime updates."""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from core.exceptions import StreamConnectionError


class SseEvent(BaseModel):
    """A typed Server-Sent Event payload."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    event: str
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class _Subscriber:
    user_id: str
    queue: asyncio.Queue[SseEvent]


class SseEventBus:
    """Small in-memory pub/sub bus, replaceable with Redis Stream later."""

    def __init__(
        self,
        *,
        max_connections_per_user: int,
        reconnect_retry_ms: int,
        queue_size: int = 100,
    ) -> None:
        self._max_connections_per_user = max_connections_per_user
        self._reconnect_retry_ms = reconnect_retry_ms
        self._queue_size = queue_size
        self._subscribers: dict[str, dict[str, _Subscriber]] = {}
        self._user_connection_counts: dict[str, int] = {}

    def assert_can_connect(self, user_id: str) -> None:
        current = self._user_connection_counts.get(user_id, 0)
        if current >= self._max_connections_per_user:
            raise StreamConnectionError(
                message="Too many active SSE connections for this user.",
                detail=f"limit={self._max_connections_per_user}",
            )

    @asynccontextmanager
    async def subscribe(self, *, space_id: str, user_id: str) -> AsyncIterator[asyncio.Queue[SseEvent]]:
        self.assert_can_connect(user_id)
        subscriber_id = str(uuid4())
        queue: asyncio.Queue[SseEvent] = asyncio.Queue(maxsize=self._queue_size)

        self._subscribers.setdefault(space_id, {})[subscriber_id] = _Subscriber(
            user_id=user_id,
            queue=queue,
        )
        self._user_connection_counts[user_id] = self._user_connection_counts.get(user_id, 0) + 1
        try:
            yield queue
        finally:
            subscribers = self._subscribers.get(space_id)
            if subscribers and subscriber_id in subscribers:
                del subscribers[subscriber_id]
                if not subscribers:
                    del self._subscribers[space_id]

            remaining = max(0, self._user_connection_counts.get(user_id, 0) - 1)
            if remaining:
                self._user_connection_counts[user_id] = remaining
            else:
                self._user_connection_counts.pop(user_id, None)

    async def publish_space_event(
        self,
        *,
        space_id: str,
        event: str,
        data: dict[str, Any],
        target_user_ids: Optional[set[str]] = None,
    ) -> SseEvent:
        sse_event = SseEvent(event=event, data=data)
        for subscriber in list(self._subscribers.get(space_id, {}).values()):
            if target_user_ids is not None and subscriber.user_id not in target_user_ids:
                continue
            self._put_latest(subscriber.queue, sse_event)
        return sse_event

    def make_event(self, event: str, data: dict[str, Any] | None = None) -> SseEvent:
        return SseEvent(event=event, data=data or {})

    def format_event(self, event: SseEvent, *, include_retry: bool = False) -> str:
        lines = [f"id: {event.id}", f"event: {event.event}"]
        if include_retry:
            lines.append(f"retry: {self._reconnect_retry_ms}")

        data = json.dumps(event.data, ensure_ascii=False, default=_json_default)
        for line in data.splitlines() or ["{}"]:
            lines.append(f"data: {line}")
        return "\n".join(lines) + "\n\n"

    @staticmethod
    def _put_latest(queue: asyncio.Queue[SseEvent], event: SseEvent) -> None:
        try:
            queue.put_nowait(event)
            return
        except asyncio.QueueFull:
            pass

        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        queue.put_nowait(event)


def _json_default(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)
