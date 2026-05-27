"""Heartbeat checks for proactive Ami behavior."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from infrastructure.models.message import MessageSenderType
from infrastructure.models.space import DBSpace
from infrastructure.repositories.message_repository import MessageRepository
from infrastructure.repositories.space_repository import SpaceRepository


@dataclass(frozen=True)
class HeartbeatDecision:
    """A dry-run proactive decision made by the heartbeat loop."""

    space_id: str
    should_send: bool
    reason: str
    room_scope: str = "SHARED"


class HeartbeatService:
    """Evaluates whether Ami should proactively speak, without sending by default."""

    def __init__(
        self,
        *,
        space_repository: SpaceRepository,
        message_repository: MessageRepository,
    ) -> None:
        self._space_repository = space_repository
        self._message_repository = message_repository

    async def evaluate_active_spaces(
        self,
        *,
        limit: int = 100,
        now: datetime | None = None,
    ) -> list[HeartbeatDecision]:
        spaces = await self._space_repository.list_active_spaces(limit=limit)
        timestamp = now or datetime.now(timezone.utc)
        decisions: list[HeartbeatDecision] = []
        for space in spaces:
            decisions.append(
                await self.evaluate_shared_idle(space=space, now=timestamp)
            )
        return decisions

    async def evaluate_shared_idle(
        self,
        *,
        space: DBSpace,
        now: datetime,
        idle_after: timedelta = timedelta(hours=4),
    ) -> HeartbeatDecision:
        messages = await self._message_repository.list_messages(
            space_id=space.id,
            room_scope="SHARED",
            limit=10,
        )
        latest_user_message = next(
            (
                message
                for message in reversed(messages)
                if message.sender_type == MessageSenderType.USER
            ),
            None,
        )
        if latest_user_message is None:
            return HeartbeatDecision(
                space_id=space.id,
                should_send=False,
                reason="shared_room_has_no_user_history",
            )

        idle_for = now - latest_user_message.created_at
        if idle_for >= idle_after:
            return HeartbeatDecision(
                space_id=space.id,
                should_send=True,
                reason="shared_room_idle_over_4_hours",
            )
        return HeartbeatDecision(
            space_id=space.id,
            should_send=False,
            reason="shared_room_recently_active",
        )
