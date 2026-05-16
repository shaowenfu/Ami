"""User repository backed by MongoDB Atlas."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, ReturnDocument
from pymongo.errors import DuplicateKeyError

from infrastructure.models.user import DBUser


class UserRepository:
    """Data access layer for the `users` collection."""

    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._collection = database["users"]
        self._indexes_ready = False

    async def _ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        await self._collection.create_index([("username", ASCENDING)], unique=True)
        await self._collection.create_index([("phone", ASCENDING)], unique=True)
        self._indexes_ready = True

    async def get_by_id(self, user_id: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        return self._to_user(await self._collection.find_one({"id": user_id}))

    async def get_by_username(self, username: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        return self._to_user(await self._collection.find_one({"username": username}))

    async def get_by_phone(self, phone: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        return self._to_user(await self._collection.find_one({"phone": phone}))

    async def get_by_identifier(self, identifier: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        document = await self._collection.find_one(
            {"$or": [{"username": identifier}, {"phone": identifier}]}
        )
        return self._to_user(document)

    async def create_user(
        self,
        username: str,
        phone: str,
        password_hash: str,
        phone_verified_at=None,
        user_id: Optional[str] = None,
    ) -> Optional[DBUser]:
        await self._ensure_indexes()
        now = datetime.now(timezone.utc)
        document = {
            "id": user_id or str(uuid4()),
            "username": username,
            "phone": phone,
            "password_hash": password_hash,
            "is_active": True,
            "phone_verified_at": phone_verified_at,
            "created_at": now,
            "updated_at": now,
        }
        try:
            await self._collection.insert_one(document)
        except DuplicateKeyError:
            return None
        return DBUser.model_validate(document)

    async def update_password(self, user_id: str, new_password_hash: str) -> bool:
        await self._ensure_indexes()
        result = await self._collection.update_one(
            {"id": user_id},
            {
                "$set": {
                    "password_hash": new_password_hash,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.modified_count > 0

    async def set_active(self, user_id: str, is_active: bool) -> bool:
        await self._ensure_indexes()
        result = await self._collection.update_one(
            {"id": user_id},
            {
                "$set": {
                    "is_active": is_active,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        return result.modified_count > 0

    async def reactivate_user(
        self,
        user_id: str,
        username: str,
        password_hash: str,
        phone_verified_at: datetime,
    ) -> Optional[DBUser]:
        await self._ensure_indexes()
        try:
            result = await self._collection.find_one_and_update(
                {"id": user_id},
                {
                    "$set": {
                        "username": username,
                        "password_hash": password_hash,
                        "is_active": True,
                        "phone_verified_at": phone_verified_at,
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            return None
        return self._to_user(result)

    @staticmethod
    def _to_user(document: Optional[dict]) -> Optional[DBUser]:
        if document is None:
            return None
        return DBUser.model_validate(document)
