"""Message workflows for relationship spaces."""

from __future__ import annotations

from typing import Callable, Optional, TYPE_CHECKING

from core.exceptions import LLMServiceError
from core.exceptions import PermissionDeniedError, ResourceNotFoundError
from infrastructure.models.message import (
    CreateMessageRequest,
    MessageResponse,
    MessageSenderType,
    RoomScopeInput,
)
from infrastructure.models.space import SpaceStatus
from infrastructure.repositories.message_repository import MessageRepository
from infrastructure.repositories.space_repository import SpaceRepository
from services.basic.sse import SseEventBus

if TYPE_CHECKING:  # pragma: no cover
    from services.basic.llm import ModelService


class MessageService:
    """Business logic for space-scoped chat messages."""

    def __init__(
        self,
        *,
        message_repository: MessageRepository,
        space_repository: SpaceRepository,
        event_bus: SseEventBus,
        model_service_factory: Callable[[], "ModelService"],
    ) -> None:
        self._message_repository = message_repository
        self._space_repository = space_repository
        self._event_bus = event_bus
        self._model_service_factory = model_service_factory

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
    ) -> None:
        """Generate a basic Ami reply and stream it through SSE."""

        target_user_ids = None if room_scope == "SHARED" else {current_user_id}
        chunks: list[str] = []
        try:
            model_service = self._model_service_factory()
            async for chunk in model_service.generate_response_stream(
                system_prompt=self._build_basic_system_prompt(room_scope),
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

    async def _require_space_member(self, space_id: str, user_id: str) -> None:
        space = await self._space_repository.get_space_by_id(space_id)
        if space is None or space.status != SpaceStatus.ACTIVE:
            raise ResourceNotFoundError(message="Space not found.")
        if user_id not in space.member_ids:
            raise PermissionDeniedError(message="You are not a member of this space.")

    @staticmethod
    def _resolve_room_scope(room_scope: RoomScopeInput, current_user_id: str) -> str:
        if room_scope == RoomScopeInput.SHARED:
            return "SHARED"
        return f"PRIVATE:{current_user_id}"

    @staticmethod
    def _build_basic_system_prompt(room_scope: str) -> str:
        privacy_rule = (
            "This is a shared room with both partners and Ami. Never mention private-room facts."
            if room_scope == "SHARED"
            else "This is a private room between the current user and Ami. Do not reveal it to the partner."
        )
        return (
            "You are Ami, a warm relationship companion for a two-person relationship space. "
            "Reply in concise, gentle Chinese. Help the user feel heard, clarify needs, and suggest one small next step. "
            f"{privacy_rule}"
        )
