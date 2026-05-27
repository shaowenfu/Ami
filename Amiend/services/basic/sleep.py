"""Daily sleep digestion for Ami relationship context."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Callable, TYPE_CHECKING

from core.logger import get_logger
from infrastructure.models.message import DBMessage
from infrastructure.models.space import AgentProfile, DBSpace
from infrastructure.repositories.message_repository import MessageRepository
from infrastructure.repositories.space_repository import SpaceRepository

if TYPE_CHECKING:  # pragma: no cover
    from services.basic.llm import ModelService

logger = get_logger(__name__)


@dataclass(frozen=True)
class SleepDigestResult:
    """Outcome of one space-level sleep digestion."""

    space_id: str
    dry_run: bool
    private_a_count: int
    private_b_count: int
    shared_count: int
    updated: bool


class SleepDigestService:
    """Condenses yesterday's conversations into stable long-term context fields."""

    def __init__(
        self,
        *,
        space_repository: SpaceRepository,
        message_repository: MessageRepository,
        model_service_factory: Callable[[], "ModelService"],
    ) -> None:
        self._space_repository = space_repository
        self._message_repository = message_repository
        self._model_service_factory = model_service_factory

    async def digest_space_yesterday(
        self,
        *,
        space: DBSpace,
        now: datetime | None = None,
        dry_run: bool = True,
    ) -> SleepDigestResult:
        start_at, end_at = _previous_utc_day(now or datetime.now(timezone.utc))
        user_a_id = space.member_ids[0] if space.member_ids else ""
        user_b_id = space.member_ids[1] if len(space.member_ids) > 1 else ""

        private_a = await self._private_messages(space.id, user_a_id, start_at, end_at)
        private_b = await self._private_messages(space.id, user_b_id, start_at, end_at)
        shared = await self._messages(space.id, "SHARED", start_at, end_at)

        has_messages = bool(private_a or private_b or shared)
        if dry_run or not has_messages:
            return SleepDigestResult(
                space_id=space.id,
                dry_run=dry_run,
                private_a_count=len(private_a),
                private_b_count=len(private_b),
                shared_count=len(shared),
                updated=False,
            )

        model_service = self._model_service_factory()
        response = await model_service.generate_response(
            system_prompt=_sleep_system_prompt(space),
            user_input=_sleep_user_input(
                space=space,
                private_a=private_a,
                private_b=private_b,
                shared=shared,
            ),
        )
        payload = _parse_digest_payload(response)
        updated_profile = AgentProfile(
            name=space.agent_profile.name,
            self_recognition=payload.get(
                "self_recognition",
                space.agent_profile.self_recognition,
            ),
            prompt=space.agent_profile.prompt,
        )
        updated = await self._space_repository.update_context_summaries(
            space_id=space.id,
            user_a_profile=payload.get("user_a_profile", space.user_a_profile),
            user_b_profile=payload.get("user_b_profile", space.user_b_profile),
            relationship_summary=payload.get(
                "relationship_summary",
                space.relationship_summary,
            ),
            agent_profile=updated_profile,
        )

        return SleepDigestResult(
            space_id=space.id,
            dry_run=False,
            private_a_count=len(private_a),
            private_b_count=len(private_b),
            shared_count=len(shared),
            updated=updated is not None,
        )

    async def digest_active_spaces_yesterday(
        self,
        *,
        limit: int = 100,
        dry_run: bool = True,
    ) -> list[SleepDigestResult]:
        spaces = await self._space_repository.list_active_spaces(limit=limit)
        results: list[SleepDigestResult] = []
        for space in spaces:
            results.append(
                await self.digest_space_yesterday(space=space, dry_run=dry_run)
            )
        return results

    async def _private_messages(
        self,
        space_id: str,
        user_id: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[DBMessage]:
        if not user_id:
            return []
        return await self._messages(space_id, f"PRIVATE:{user_id}", start_at, end_at)

    async def _messages(
        self,
        space_id: str,
        room_scope: str,
        start_at: datetime,
        end_at: datetime,
    ) -> list[DBMessage]:
        return await self._message_repository.list_messages_between(
            space_id=space_id,
            room_scope=room_scope,
            start_at=start_at,
            end_at=end_at,
        )


def _previous_utc_day(now: datetime) -> tuple[datetime, datetime]:
    today = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    return today - timedelta(days=1), today


def _sleep_system_prompt(space: DBSpace) -> str:
    return (
        "你是 Ami 的睡眠消化进程。把一天的私聊和群聊压缩成长期状态，"
        "保留重要事实、情绪模式、关系承诺和 Ami 的自我认知变化。"
        "私聊原文不能进入可直接暴露的摘要，只能沉淀成谨慎、低敏的关系理解。"
        "只返回 JSON，字段为 user_a_profile, user_b_profile, relationship_summary, self_recognition。"
        f"Ami 当前名字：{space.agent_profile.name}"
    )


def _sleep_user_input(
    *,
    space: DBSpace,
    private_a: list[DBMessage],
    private_b: list[DBMessage],
    shared: list[DBMessage],
) -> str:
    return json.dumps(
        {
            "existing": {
                "user_a_profile": space.user_a_profile,
                "user_b_profile": space.user_b_profile,
                "relationship_summary": space.relationship_summary,
                "self_recognition": space.agent_profile.self_recognition,
            },
            "yesterday": {
                "user_a_private": [_message_for_digest(message) for message in private_a],
                "user_b_private": [_message_for_digest(message) for message in private_b],
                "shared": [_message_for_digest(message) for message in shared],
            },
        },
        ensure_ascii=False,
    )


def _message_for_digest(message: DBMessage) -> dict[str, str]:
    return {
        "time": message.created_at.isoformat(),
        "sender_type": message.sender_type.value,
        "sender_id": message.sender_id or "",
        "content": message.content,
    }


def _parse_digest_payload(raw: str) -> dict[str, str]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Sleep digest returned non-JSON output.")
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {
        key: value.strip()
        for key, value in parsed.items()
        if isinstance(key, str) and isinstance(value, str)
    }
