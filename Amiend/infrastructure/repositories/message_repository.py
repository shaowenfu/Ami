"""Repository for relationship space messages."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from infrastructure.models.message import DBMessage, MessageSenderType


class MessageRepository:
    """Data access for the `messages` collection."""

    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._collection = database["messages"]
        self._indexes_ready = False

    async def _ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        await self._collection.create_index([("id", ASCENDING)], unique=True)
        await self._collection.create_index(
            [("space_id", ASCENDING), ("room_scope", ASCENDING), ("created_at", DESCENDING)]
        )
        await self._collection.create_index([("space_id", ASCENDING), ("created_at", DESCENDING)])
        self._indexes_ready = True

    async def create_message(
        self,
        *,
        space_id: str,
        sender_type: MessageSenderType,
        sender_id: Optional[str],
        room_scope: str,
        content: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> DBMessage:
        await self._ensure_indexes()
        now = datetime.now(timezone.utc)
        document = {
            "id": str(uuid4()),
            "space_id": space_id,
            "sender_type": sender_type.value,
            "sender_id": sender_id,
            "room_scope": room_scope,
            "content": content,
            "metadata": metadata or {},
            "created_at": now,
        }
        await self._collection.insert_one(document)
        return DBMessage.model_validate(document)

    async def list_messages(
        self,
        *,
        space_id: str,
        room_scope: str,
        limit: int,
    ) -> list[DBMessage]:
        await self._ensure_indexes()
        cursor = (
            self._collection.find({"space_id": space_id, "room_scope": room_scope})
            .sort("created_at", DESCENDING)
            .limit(limit)
        )
        messages = [DBMessage.model_validate(document) async for document in cursor]
        messages.reverse()
        return messages

    async def list_messages_between(
        self,
        *,
        space_id: str,
        room_scope: str,
        start_at: datetime,
        end_at: datetime,
        limit: int = 500,
    ) -> list[DBMessage]:
        await self._ensure_indexes()
        cursor = (
            self._collection.find(
                {
                    "space_id": space_id,
                    "room_scope": room_scope,
                    "created_at": {"$gte": start_at, "$lt": end_at},
                }
            )
            .sort("created_at", ASCENDING)
            .limit(limit)
        )
        return [DBMessage.model_validate(document) async for document in cursor]
