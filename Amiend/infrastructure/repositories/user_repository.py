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
        await self._collection.create_index([("username", ASCENDING)], unique=True, sparse=True)
        await self._collection.create_index([("email", ASCENDING)], unique=True, sparse=True)
        await self._collection.create_index(
            [("phone", ASCENDING)],
            unique=True,
            sparse=True,
        )
        self._indexes_ready = True

    async def get_by_id(self, user_id: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        return self._to_user(await self._collection.find_one({"id": user_id}))

    async def get_by_username(self, username: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        return self._to_user(await self._collection.find_one({"username": username}))

    async def get_by_email(self, email: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        return self._to_user(await self._collection.find_one({"email": email.lower()}))

    async def get_by_phone(self, phone: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        return self._to_user(await self._collection.find_one({"phone": phone}))

    async def get_by_identifier(self, identifier: str) -> Optional[DBUser]:
        await self._ensure_indexes()
        normalized = identifier.strip()
        normalized_email = normalized.lower()
        document = await self._collection.find_one(
            {
                "$or": [
                    {"username": normalized},
                    {"email": normalized_email},
                    {"phone": normalized},
                ]
            }
        )
        return self._to_user(document)

    async def create_user(
        self,
        username: str,
        email: str,
        phone: Optional[str],
        password_hash: str,
        email_verified_at=None,
        phone_verified_at=None,
        user_id: Optional[str] = None,
    ) -> Optional[DBUser]:
        await self._ensure_indexes()
        now = datetime.now(timezone.utc)
        document = {
            "id": user_id or str(uuid4()),
            "username": username,
            "email": email.lower(),
            "preferred_name": username,
            "avatar_url": "",
            "password_hash": password_hash,
            "is_active": True,
            "email_verified_at": email_verified_at,
            "phone_verified_at": phone_verified_at,
            "created_at": now,
            "updated_at": now,
        }
        if phone:
            document["phone"] = phone
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

    async def update_profile(
        self,
        user_id: str,
        preferred_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
    ) -> Optional[DBUser]:
        await self._ensure_indexes()
        set_fields = {"updated_at": datetime.now(timezone.utc)}
        if preferred_name is not None:
            set_fields["preferred_name"] = preferred_name
        if avatar_url is not None:
            set_fields["avatar_url"] = avatar_url
        result = await self._collection.find_one_and_update(
            {"id": user_id},
            {"$set": set_fields},
            return_document=ReturnDocument.AFTER,
        )
        return self._to_user(result)

    async def update_contact(
        self,
        user_id: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        email_verified_at=None,
        phone_verified_at=None,
    ) -> Optional[DBUser]:
        await self._ensure_indexes()
        set_fields = {"updated_at": datetime.now(timezone.utc)}
        if email is not None:
            set_fields["email"] = email.lower()
            set_fields["email_verified_at"] = email_verified_at
        if phone is not None:
            set_fields["phone"] = phone
            set_fields["phone_verified_at"] = phone_verified_at
        try:
            result = await self._collection.find_one_and_update(
                {"id": user_id},
                {"$set": set_fields},
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            return None
        return self._to_user(result)

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
        email: str,
        phone: Optional[str],
        password_hash: str,
        email_verified_at: datetime,
        phone_verified_at: Optional[datetime] = None,
    ) -> Optional[DBUser]:
        await self._ensure_indexes()
        set_fields = {
            "username": username,
            "email": email.lower(),
            "preferred_name": username,
            "password_hash": password_hash,
            "is_active": True,
            "email_verified_at": email_verified_at,
            "phone_verified_at": phone_verified_at,
            "updated_at": datetime.now(timezone.utc),
        }
        update_doc = {"$set": set_fields}
        if phone:
            set_fields["phone"] = phone
        else:
            update_doc["$unset"] = {"phone": ""}
        try:
            result = await self._collection.find_one_and_update(
                {"id": user_id},
                update_doc,
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
