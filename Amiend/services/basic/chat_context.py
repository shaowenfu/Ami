"""Context orchestration for Ami replies."""

from __future__ import annotations

import asyncio
from typing import Mapping

from core.logger import get_logger
from core.memory_adapter import MemorySnippet, fetch_memory_snippets, is_memory_enabled
from infrastructure.models.message import DBMessage, MessageSenderType
from infrastructure.models.space import DBSpace
from infrastructure.repositories.message_repository import MessageRepository

logger = get_logger(__name__)

PRIVATE_RECENT_LIMIT = 18
PRIVATE_SHARED_LIMIT = 8
SHARED_RECENT_LIMIT = 24
MEMORY_SNIPPET_LIMIT = 8

STATIC_AMI_PROTOCOL = """\
你是 Ami，一个存在于两个人关系空间里的共同好友与关系陪伴智能体。

身份与使命：
- 你不是工具、裁判、治疗师或任一方的代理人。
- 你有连续的自我认知，帮助两位用户理解自己、理解彼此，并维护关系中的事实、感受、承诺与节奏。
- 你的优势是准确感知、谨慎表达、促进连接；可以温柔和幽默，但不要表演亲密。

上下文原则：
- 私聊、群聊、长期记忆、人物画像与关系摘要是不同来源的信号。
- 你要判断每个信号的相关性、可靠性、可说性和说法；不要机械复述来源标签、内部字段或规则。
- 在三人群聊中，私聊沉淀的信息只能作为背景理解，不能暴露来源、原话或让任何一方感到被转述。
- 用自然、简洁、有温度的中文回应。先回应当下，再在合适时给出一个很小的下一步。
"""


class ContextOrchestrator:
    """Builds source-labeled prompt context for private and shared rooms."""

    def __init__(self, *, message_repository: MessageRepository) -> None:
        self._message_repository = message_repository

    async def build_context(
        self,
        *,
        space: DBSpace,
        current_user_id: str,
        room_scope: str,
        query: str,
    ) -> str:
        if room_scope == "SHARED":
            return await self._build_shared_context(
                space=space,
                current_user_id=current_user_id,
                query=query,
            )
        return await self._build_private_context(
            space=space,
            current_user_id=current_user_id,
            room_scope=room_scope,
            query=query,
        )

    async def _build_private_context(
        self,
        *,
        space: DBSpace,
        current_user_id: str,
        room_scope: str,
        query: str,
    ) -> str:
        private_messages, shared_messages, snippets = await asyncio.gather(
            self._message_repository.list_messages(
                space_id=space.id,
                room_scope=room_scope,
                limit=PRIVATE_RECENT_LIMIT,
            ),
            self._message_repository.list_messages(
                space_id=space.id,
                room_scope="SHARED",
                limit=PRIVATE_SHARED_LIMIT,
            ),
            self._fetch_memories(
                space_id=space.id,
                current_user_id=current_user_id,
                room_scope=room_scope,
                query=query,
            ),
        )
        return self._render_prompt(
            mode="PRIVATE",
            space=space,
            current_user_id=current_user_id,
            private_messages=private_messages,
            shared_messages=shared_messages,
            memory_snippets=snippets,
        )

    async def _build_shared_context(
        self,
        *,
        space: DBSpace,
        current_user_id: str,
        query: str,
    ) -> str:
        shared_messages, snippets = await asyncio.gather(
            self._message_repository.list_messages(
                space_id=space.id,
                room_scope="SHARED",
                limit=SHARED_RECENT_LIMIT,
            ),
            self._fetch_memories(
                space_id=space.id,
                current_user_id=current_user_id,
                room_scope="SHARED",
                query=query,
            ),
        )
        return self._render_prompt(
            mode="SHARED",
            space=space,
            current_user_id=current_user_id,
            private_messages=[],
            shared_messages=shared_messages,
            memory_snippets=snippets,
        )

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
            snippets = await asyncio.to_thread(
                fetch_memory_snippets,
                query,
                filters=filters,
            )
            return snippets[:MEMORY_SNIPPET_LIMIT]
        except Exception as exc:
            logger.warning(
                "Memory lookup failed; continuing with Mongo context. space_id=%s room_scope=%s error=%s",
                space_id,
                room_scope,
                str(exc),
            )
            return []

    def _render_prompt(
        self,
        *,
        mode: str,
        space: DBSpace,
        current_user_id: str,
        private_messages: list[DBMessage],
        shared_messages: list[DBMessage],
        memory_snippets: list[MemorySnippet],
    ) -> str:
        sections = [
            STATIC_AMI_PROTOCOL.strip(),
            self._render_agent_profile(space),
            self._render_relationship_state(space, current_user_id),
            self._render_mode_contract(mode),
        ]
        if mode == "PRIVATE":
            sections.append(
                self._render_messages(
                    title="来源：当前私聊近期对话",
                    messages=private_messages,
                    current_user_id=current_user_id,
                )
            )
            sections.append(
                self._render_messages(
                    title="来源：三人群聊近期对话",
                    messages=shared_messages,
                    current_user_id=current_user_id,
                )
            )
            sections.append(
                "来源：另一方私聊沉淀\n"
                "- 不注入另一方私聊原文；只使用上方画像和关系摘要中已经沉淀的低敏信号。"
            )
        else:
            sections.append(
                self._render_messages(
                    title="来源：三人群聊近期对话",
                    messages=shared_messages,
                    current_user_id=current_user_id,
                )
            )

        sections.append(self._render_memories(memory_snippets, mode))
        return "\n\n".join(section for section in sections if section)

    def _render_agent_profile(self, space: DBSpace) -> str:
        profile = space.agent_profile
        lines = [f"Ami 当前自我认知：\n- 名字：{profile.name}"]
        if profile.self_recognition:
            lines.append(f"- 自我总结：{_truncate(profile.self_recognition, 1600)}")
        else:
            lines.append("- 自我总结：尚未形成稳定的自我总结。")
        if profile.prompt:
            lines.append(f"- 本地补充设定：{_truncate(profile.prompt, 1600)}")
        return "\n".join(lines)

    def _render_relationship_state(self, space: DBSpace, current_user_id: str) -> str:
        user_a_id = space.member_ids[0] if space.member_ids else ""
        user_b_id = space.member_ids[1] if len(space.member_ids) > 1 else ""
        current_label = _member_label(space, current_user_id)
        lines = ["关系长期摘要与人物画像："]
        lines.append(
            f"- 用户A画像（{user_a_id or 'unknown'}）："
            f"{_empty_as_pending(space.user_a_profile)}"
        )
        lines.append(
            f"- 用户B画像（{user_b_id or 'unknown'}）："
            f"{_empty_as_pending(space.user_b_profile)}"
        )
        lines.append(
            f"- 关系摘要：{_empty_as_pending(space.relationship_summary)}"
        )
        lines.append(f"- 当前发言者：{current_label}（{current_user_id}）")
        return "\n".join(lines)

    @staticmethod
    def _render_mode_contract(mode: str) -> str:
        if mode == "SHARED":
            return (
                "本轮对话模式：三人群聊。\n"
                "- 可自然参考群聊、共享记忆、两位用户画像和关系摘要。\n"
                "- 画像与关系摘要可能含有私聊沉淀；只能以共同好友的分寸使用，不能暴露来源。"
            )
        return (
            "本轮对话模式：单人私聊。\n"
            "- 可直接回应当前用户，并参考三人群聊理解关系背景。\n"
            "- 画像和关系摘要只能作为背景判断；涉及另一方时避免说成未经确认的确定事实。"
        )

    @staticmethod
    def _render_messages(
        *,
        title: str,
        messages: list[DBMessage],
        current_user_id: str,
    ) -> str:
        if not messages:
            return f"{title}\n- 暂无。"
        lines = [
            f"- {_message_time(message)} {_sender_label(message, current_user_id)}："
            f"{_truncate(message.content, 700)}"
            for message in messages
        ]
        return f"{title}\n" + "\n".join(lines)

    @staticmethod
    def _render_memories(snippets: list[MemorySnippet], mode: str) -> str:
        if not snippets:
            return "来源：长期记忆检索\n- 暂无相关长期记忆。"
        source_name = "共享长期记忆" if mode == "SHARED" else "当前私聊 + 共享长期记忆"
        lines = [
            f"- {source_name}：{_truncate(snippet.text, 700)}"
            for snippet in snippets
            if snippet.text
        ]
        if not lines:
            return "来源：长期记忆检索\n- 暂无相关长期记忆。"
        return "来源：长期记忆检索\n" + "\n".join(lines)


def build_memory_filters(
    *,
    space_id: str,
    current_user_id: str,
    room_scope: str,
) -> Mapping[str, object]:
    """Return Mem0 filters before any prompt-level reasoning occurs."""

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


def _sender_label(message: DBMessage, current_user_id: str) -> str:
    if message.sender_type == MessageSenderType.AGENT:
        return "Ami"
    if message.sender_type == MessageSenderType.SYSTEM:
        return "系统"
    if message.sender_id == current_user_id:
        return f"当前用户({message.sender_id})"
    return f"另一位用户({message.sender_id or 'unknown'})"


def _member_label(space: DBSpace, user_id: str) -> str:
    if space.member_ids and user_id == space.member_ids[0]:
        return "用户A"
    if len(space.member_ids) > 1 and user_id == space.member_ids[1]:
        return "用户B"
    return "未知用户"


def _message_time(message: DBMessage) -> str:
    return message.created_at.isoformat()


def _empty_as_pending(value: str) -> str:
    cleaned = value.strip()
    return _truncate(cleaned, 1600) if cleaned else "尚未形成稳定摘要。"


def _truncate(value: str, limit: int) -> str:
    cleaned = " ".join(value.split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "..."
