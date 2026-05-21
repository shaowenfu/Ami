"""Space message and SSE routes."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Query, Request, status
from fastapi.responses import StreamingResponse

from core.config import settings
from dependencies.providers import CurrentUserIdDep, MessageServiceDep, SpaceServiceDep, SseEventBusDep
from infrastructure.models.message import CreateMessageRequest, MessageResponse, RoomScopeInput


router = APIRouter(prefix="/spaces/{space_id}", tags=["messages"])


@router.get("/messages", response_model=list[MessageResponse], summary="查询空间聊天消息")
async def list_messages(
    space_id: str,
    message_service: MessageServiceDep,
    current_user_id: CurrentUserIdDep,
    room_scope: RoomScopeInput = Query(default=RoomScopeInput.SHARED),
    limit: int = Query(default=50, ge=1, le=100),
) -> list[MessageResponse]:
    """Return messages for the selected room scope after membership validation."""

    return await message_service.list_messages(
        space_id=space_id,
        current_user_id=current_user_id,
        room_scope=room_scope,
        limit=limit,
    )


@router.post(
    "/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="发送空间聊天消息",
)
async def create_message(
    space_id: str,
    payload: CreateMessageRequest,
    background_tasks: BackgroundTasks,
    message_service: MessageServiceDep,
    current_user_id: CurrentUserIdDep,
) -> MessageResponse:
    """Persist a user message and publish a `message.created` SSE event."""

    message = await message_service.create_user_message(
        space_id=space_id,
        current_user_id=current_user_id,
        payload=payload,
    )
    background_tasks.add_task(
        message_service.generate_agent_reply,
        space_id=space_id,
        current_user_id=current_user_id,
        room_scope=message.room_scope,
        user_input=message.content,
    )
    return message


@router.get("/events", summary="订阅空间 SSE 事件流")
async def stream_space_events(
    space_id: str,
    request: Request,
    space_service: SpaceServiceDep,
    event_bus: SseEventBusDep,
    current_user_id: CurrentUserIdDep,
) -> StreamingResponse:
    """Subscribe to space-scoped server-sent events."""

    await space_service.get_space(space_id, current_user_id)
    event_bus.assert_can_connect(current_user_id)

    async def event_stream() -> AsyncIterator[str]:
        async with event_bus.subscribe(space_id=space_id, user_id=current_user_id) as queue:
            connected = event_bus.make_event(
                "connected",
                {
                    "space_id": space_id,
                    "user_id": current_user_id,
                    "server_time": datetime.now(timezone.utc),
                },
            )
            yield event_bus.format_event(connected, include_retry=True)

            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(
                        queue.get(),
                        timeout=settings.SSE_HEARTBEAT_INTERVAL_SECONDS,
                    )
                    yield event_bus.format_event(event)
                except asyncio.TimeoutError:
                    heartbeat = event_bus.make_event(
                        "heartbeat",
                        {
                            "space_id": space_id,
                            "server_time": datetime.now(timezone.utc),
                        },
                    )
                    yield event_bus.format_event(heartbeat)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
