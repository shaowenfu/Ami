"""Chat message models for relationship spaces."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class RoomScopeInput(str, Enum):
    """Client-facing room scope choices."""

    PRIVATE_SELF = "PRIVATE_SELF"
    SHARED = "SHARED"


class MessageSenderType(str, Enum):
    """Message author category."""

    USER = "USER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"


class DBMessage(BaseModel):
    """Internal MongoDB representation of a chat message."""

    id: str
    space_id: str
    sender_type: MessageSenderType
    sender_id: Optional[str] = None
    room_scope: str
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class CreateMessageRequest(BaseModel):
    """Payload for creating a user message inside a relationship space."""

    room_scope: RoomScopeInput = RoomScopeInput.SHARED
    content: str = Field(min_length=1, max_length=8000)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("content")
    @classmethod
    def strip_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("content cannot be empty")
        return cleaned


class MessageResponse(BaseModel):
    """Public chat message payload."""

    id: str
    space_id: str
    sender_type: MessageSenderType
    sender_id: Optional[str]
    room_scope: str
    content: str
    metadata: dict[str, Any]
    created_at: datetime

    @classmethod
    def from_db(cls, message: DBMessage) -> "MessageResponse":
        return cls.model_validate(message.model_dump())
