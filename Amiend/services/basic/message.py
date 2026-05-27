"""Message workflows for relationship spaces."""

from __future__ import annotations

import asyncio
from typing import Callable, Optional, TYPE_CHECKING

from core.exceptions import LLMServiceError
from core.exceptions import PermissionDeniedError, ResourceNotFoundError
from core.logger import get_logger
from core.memory_adapter import is_memory_enabled, store_memories
from infrastructure.models.message import (
    CreateMessageRequest,
    MessageResponse,
    MessageSenderType,
    RoomScopeInput,
)
from infrastructure.models.space import DBSpace, SpaceStatus
from infrastructure.repositories.message_repository import MessageRepository
from infrastructure.repositories.space_repository import SpaceRepository
from services.basic.chat_context import (
    ContextOrchestrator,
    ami_agent_id,
    memory_visibility_for_room,
    private_memory_user_id,
    shared_memory_user_id,
)
from services.basic.sse import SseEventBus

if TYPE_CHECKING:  # pragma: no cover
    from services.basic.llm import ModelService

logger = get_logger(__name__)


class MessageService:
    """Business logic for space-scoped chat messages."""

    def __init__(
        self,
        *,
        message_repository: MessageRepository,
        space_repository: SpaceRepository,
        event_bus: SseEventBus,
        model_service_factory: Callable[[], "ModelService"],
        context_orchestrator: ContextOrchestrator,
    ) -> None:
        self._message_repository = message_repository
        self._space_repository = space_repository
        self._event_bus = event_bus
        self._model_service_factory = model_service_factory
        self._context_orchestrator = context_orchestrator

    async def list_messages(
        self,
        *,
        space_id: str,
        current_user_id: str,
        room_scope: RoomScopeInput,
        limit: int,
    ) -> list[MessageResponse]:
        await self._require_space_member(space_id, current_user_id)
        resolved_scope = self._resolve_room_scope(room_scope, current_user_id)
        safe_limit = min(max(limit, 1), 100)
        messages = await self._message_repository.list_messages(
            space_id=space_id,
            room_scope=resolved_scope,
            limit=safe_limit,
        )
        return [MessageResponse.from_db(message) for message in messages]

    async def create_user_message(
        self,
        *,
        space_id: str,
        current_user_id: str,
        payload: CreateMessageRequest,
    ) -> MessageResponse:
        await self._require_space_member(space_id, current_user_id)
        resolved_scope = self._resolve_room_scope(payload.room_scope, current_user_id)
        message = await self._message_repository.create_message(
            space_id=space_id,
            sender_type=MessageSenderType.USER,
            sender_id=current_user_id,
            room_scope=resolved_scope,
            content=payload.content,
            metadata=payload.metadata,
        )
        response = MessageResponse.from_db(message)
        target_user_ids = None if response.room_scope == "SHARED" else {current_user_id}
        await self._event_bus.publish_space_event(
            space_id=space_id,
            event="message.created",
            target_user_ids=target_user_ids,
            data={
                "space_id": space_id,
                "message_id": response.id,
                "room_scope": response.room_scope,
                "sender_type": response.sender_type.value,
                "sender_id": response.sender_id,
                "message": response.model_dump(mode="json"),
            },
        )
        return response

    async def generate_agent_reply(
        self,
        *,
        space_id: str,
        current_user_id: str,
        room_scope: str,
        user_input: str,
        user_message_id: Optional[str] = None,
    ) -> None:
        """Generate a basic Ami reply and stream it through SSE."""

        target_user_ids = None if room_scope == "SHARED" else {current_user_id}
        chunks: list[str] = []
        try:
            space = await self._require_space_member(space_id, current_user_id)
            model_service = self._model_service_factory()
            system_prompt = await self._context_orchestrator.build_context(
                space=space,
                current_user_id=current_user_id,
                room_scope=room_scope,
                query=user_input,
            )
            async for chunk in model_service.generate_response_stream(
                system_prompt=system_prompt,
                user_input=user_input,
            ):
                chunks.append(chunk)
                await self._event_bus.publish_space_event(
                    space_id=space_id,
                    event="message.delta",
                    target_user_ids=target_user_ids,
                    data={
                        "space_id": space_id,
                        "room_scope": room_scope,
                        "sender_type": MessageSenderType.AGENT.value,
                        "sender_id": f"ami:{space_id}",
                        "chunk": chunk,
                    },
                )

            content = "".join(chunks).strip()
            if not content:
                raise LLMServiceError(message="LLM returned empty content.")

            message = await self._message_repository.create_message(
                space_id=space_id,
                sender_type=MessageSenderType.AGENT,
                sender_id=f"ami:{space_id}",
                room_scope=room_scope,
                content=content,
                metadata={"source": "basic_agent_reply"},
            )
            response = MessageResponse.from_db(message)
            await self._event_bus.publish_space_event(
                space_id=space_id,
                event="message.completed",
                target_user_ids=target_user_ids,
                data={
                    "space_id": space_id,
                    "message_id": response.id,
                    "room_scope": response.room_scope,
                    "sender_type": response.sender_type.value,
                    "sender_id": response.sender_id,
                    "message": response.model_dump(mode="json"),
                },
            )
            await self._digest_exchange_to_memory(
                space_id=space_id,
                current_user_id=current_user_id,
                room_scope=room_scope,
                user_input=user_input,
                agent_output=content,
                source_msg_ids=[
                    message_id
                    for message_id in (user_message_id, response.id)
                    if message_id
                ],
                target_user_ids=target_user_ids,
            )
        except Exception as exc:
            await self._event_bus.publish_space_event(
                space_id=space_id,
                event="message.failed",
                target_user_ids=target_user_ids,
                data={
                    "space_id": space_id,
                    "room_scope": room_scope,
                    "sender_type": MessageSenderType.AGENT.value,
                    "sender_id": f"ami:{space_id}",
                    "error": str(exc),
                },
            )

    async def _digest_exchange_to_memory(
        self,
        *,
        space_id: str,
        current_user_id: str,
        room_scope: str,
        user_input: str,
        agent_output: str,
        source_msg_ids: list[str],
        target_user_ids: Optional[set[str]],
    ) -> None:
        try:
            if not is_memory_enabled():
                return
            memory_user_id = (
                shared_memory_user_id(space_id)
                if room_scope == "SHARED"
                else private_memory_user_id(space_id, current_user_id)
            )
            result = await asyncio.to_thread(
                store_memories,
                [
                    {"role": "user", "content": user_input},
                    {"role": "assistant", "content": agent_output},
                ],
                memory_user_id,
                ami_agent_id(space_id),
                metadata={
                    "space_id": space_id,
                    "visibility": memory_visibility_for_room(room_scope),
                    "room_scope": room_scope,
                    "source": "chat_exchange",
                    "source_msg_ids": source_msg_ids,
                    "created_by": "message_service",
                },
                infer=True,
            )
            await self._event_bus.publish_space_event(
                space_id=space_id,
                event="memory.digest.completed",
                target_user_ids=target_user_ids,
                data={
                    "space_id": space_id,
                    "room_scope": room_scope,
                    "source_msg_ids": source_msg_ids,
                    "status": str(result.get("status", "SUCCEEDED")),
                },
            )
        except Exception as exc:
            logger.warning(
                "Memory digest failed; chat message remains persisted. space_id=%s room_scope=%s error=%s",
                space_id,
                room_scope,
                str(exc),
            )

    async def _require_space_member(self, space_id: str, user_id: str) -> DBSpace:
        space = await self._space_repository.get_space_by_id(space_id)
        if space is None or space.status != SpaceStatus.ACTIVE:
            raise ResourceNotFoundError(message="Space not found.")
        if user_id not in space.member_ids:
            raise PermissionDeniedError(message="You are not a member of this space.")
        return space

    @staticmethod
    def _resolve_room_scope(room_scope: RoomScopeInput, current_user_id: str) -> str:
        if room_scope == RoomScopeInput.SHARED:
            return "SHARED"
        return f"PRIVATE:{current_user_id}"
