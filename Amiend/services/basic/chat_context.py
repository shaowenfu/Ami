"""Chat context assembly for Ami replies."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Mapping

from core.logger import get_logger
from core.memory_adapter import MemorySnippet, fetch_memory_snippets, is_memory_enabled
from infrastructure.models.message import DBMessage, MessageSenderType
from infrastructure.repositories.message_repository import MessageRepository

logger = get_logger(__name__)

RECENT_MESSAGE_LIMIT = 20


@dataclass(frozen=True)
class ChatContext:
    """Prompt-ready context returned by the builder."""

    recent_messages: list[DBMessage] = field(default_factory=list)
    memory_snippets: list[MemorySnippet] = field(default_factory=list)

    def to_prompt_block(self) -> str:
        sections: list[str] = []
        if self.recent_messages:
            lines = [
                f"- {_sender_label(message)}: {_truncate(message.content, 500)}"
                for message in self.recent_messages
            ]
            sections.append("最近对话：\n" + "\n".join(lines))

        if self.memory_snippets:
            memory_lines = [
                f"- {_truncate(snippet.text, 500)}"
                for snippet in self.memory_snippets
                if snippet.text
            ]
            if memory_lines:
                sections.append("长期记忆：\n" + "\n".join(memory_lines))

        return "\n\n".join(sections)


class ChatContextBuilder:
    """Builds Mongo + Mem0 context with one room-scope privacy policy."""

    def __init__(self, *, message_repository: MessageRepository) -> None:
        self._message_repository = message_repository

    async def build_chat_context(
        self,
        *,
        space_id: str,
        current_user_id: str,
        room_scope: str,
        query: str,
    ) -> ChatContext:
        recent_messages = await self._message_repository.list_messages(
            space_id=space_id,
            room_scope=room_scope,
            limit=RECENT_MESSAGE_LIMIT,
        )
        snippets = await self._fetch_memories(
            space_id=space_id,
            current_user_id=current_user_id,
            room_scope=room_scope,
            query=query,
        )
        return ChatContext(recent_messages=recent_messages, memory_snippets=snippets)

    async def _fetch_memories(
        self,
        *,
        space_id: str,
        current_user_id: str,
        room_scope: str,
        query: str,
    ) -> list[MemorySnippet]:
        try:
            if not is_memory_enabled():
                return []
            filters = build_memory_filters(
                space_id=space_id,
                current_user_id=current_user_id,
                room_scope=room_scope,
            )
            return await asyncio.to_thread(
                fetch_memory_snippets,
                query,
                filters=filters,
            )
        except Exception as exc:
            logger.warning(
                "Memory lookup failed; continuing with Mongo recent messages. space_id=%s room_scope=%s error=%s",
                space_id,
                room_scope,
                str(exc),
            )
            return []


def build_memory_filters(
    *,
    space_id: str,
    current_user_id: str,
    room_scope: str,
) -> Mapping[str, object]:
    """Return Mem0 filters that enforce Ami room-scope privacy."""

    shared_filter = {
        "AND": [
            {"user_id": shared_memory_user_id(space_id)},
            {"metadata": {"space_id": space_id}},
            {"metadata": {"visibility": "SHARED"}},
        ]
    }
    if room_scope == "SHARED":
        return shared_filter

    return {
        "OR": [
            {
                "AND": [
                    {"user_id": private_memory_user_id(space_id, current_user_id)},
                    {"metadata": {"space_id": space_id}},
                    {"metadata": {"visibility": f"PRIVATE:{current_user_id}"}},
                ]
            },
            shared_filter,
        ]
    }


def private_memory_user_id(space_id: str, user_id: str) -> str:
    return f"space:{space_id}:private:{user_id}"


def shared_memory_user_id(space_id: str) -> str:
    return f"space:{space_id}:shared"


def ami_agent_id(space_id: str, prefix: str = "ami") -> str:
    return f"{prefix}:{space_id}"


def memory_visibility_for_room(room_scope: str) -> str:
    return "SHARED" if room_scope == "SHARED" else room_scope


def _sender_label(message: DBMessage) -> str:
    if message.sender_type == MessageSenderType.AGENT:
        return "Ami"
    if message.sender_type == MessageSenderType.SYSTEM:
        return "系统"
    return "用户"


def _truncate(value: str, limit: int) -> str:
    cleaned = " ".join(value.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "..."
