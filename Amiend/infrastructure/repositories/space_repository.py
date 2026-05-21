"""Repositories for relationship spaces and invitations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, ReturnDocument

from infrastructure.models.space import (
    AgentProfile,
    DBSpace,
    DBSpaceInvitation,
    SpaceInvitationStatus,
    SpaceMemberRole,
    SpaceStatus,
)


class SpaceRepository:
    """Data access for spaces and relationship invitations."""

    def __init__(self, database: AsyncIOMotorDatabase) -> None:
        self._spaces = database["spaces"]
        self._invitations = database["space_invitations"]
        self._indexes_ready = False

    async def _ensure_indexes(self) -> None:
        if self._indexes_ready:
            return
        await self._spaces.create_index([("id", ASCENDING)], unique=True)
        await self._spaces.create_index([("member_ids", ASCENDING), ("status", ASCENDING)])
        await self._invitations.create_index([("id", ASCENDING)], unique=True)
        await self._invitations.create_index(
            [
                ("initiator_user_id", ASCENDING),
                ("invitee_user_id", ASCENDING),
                ("status", ASCENDING),
            ]
        )
        await self._invitations.create_index([("invitee_user_id", ASCENDING), ("status", ASCENDING)])
        self._indexes_ready = True

    async def list_spaces_for_user(self, user_id: str) -> list[DBSpace]:
        await self._ensure_indexes()
        cursor = self._spaces.find(
            {"member_ids": user_id, "status": SpaceStatus.ACTIVE.value}
        ).sort("updated_at", DESCENDING)
        return [DBSpace.model_validate(document) async for document in cursor]

    async def get_space_by_id(self, space_id: str) -> Optional[DBSpace]:
        await self._ensure_indexes()
        return self._to_space(await self._spaces.find_one({"id": space_id}))

    async def get_active_space_between(self, user_a_id: str, user_b_id: str) -> Optional[DBSpace]:
        await self._ensure_indexes()
        document = await self._spaces.find_one(
            {
                "member_ids": {"$all": [user_a_id, user_b_id]},
                "status": SpaceStatus.ACTIVE.value,
            }
        )
        return self._to_space(document)

    async def create_space(self, initiator_user_id: str, invitee_user_id: str) -> DBSpace:
        await self._ensure_indexes()
        now = datetime.now(timezone.utc)
        document = {
            "id": str(uuid4()),
            "members": [
                {
                    "user_id": initiator_user_id,
                    "joined_at": now,
                    "role": SpaceMemberRole.INITIATOR.value,
                },
                {
                    "user_id": invitee_user_id,
                    "joined_at": now,
                    "role": SpaceMemberRole.INVITEE.value,
                },
            ],
            "member_ids": [initiator_user_id, invitee_user_id],
            "agent_profile": AgentProfile().model_dump(),
            "status": SpaceStatus.ACTIVE.value,
            "created_at": now,
            "updated_at": now,
        }
        await self._spaces.insert_one(document)
        return DBSpace.model_validate(document)

    async def update_agent_profile(self, space_id: str, agent_profile: AgentProfile) -> Optional[DBSpace]:
        await self._ensure_indexes()
        result = await self._spaces.find_one_and_update(
            {"id": space_id},
            {
                "$set": {
                    "agent_profile": agent_profile.model_dump(),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._to_space(result)

    async def get_pending_invitation(
        self,
        initiator_user_id: str,
        invitee_user_id: str,
    ) -> Optional[DBSpaceInvitation]:
        await self._ensure_indexes()
        document = await self._invitations.find_one(
            {
                "initiator_user_id": initiator_user_id,
                "invitee_user_id": invitee_user_id,
                "status": SpaceInvitationStatus.PENDING.value,
            }
        )
        return self._to_invitation(document)

    async def create_invitation(
        self,
        initiator_user_id: str,
        invitee_user_id: str,
        invitee_phone: str,
        message: str,
    ) -> DBSpaceInvitation:
        await self._ensure_indexes()
        now = datetime.now(timezone.utc)
        document = {
            "id": str(uuid4()),
            "initiator_user_id": initiator_user_id,
            "invitee_user_id": invitee_user_id,
            "invitee_phone": invitee_phone,
            "message": message,
            "status": SpaceInvitationStatus.PENDING.value,
            "space_id": None,
            "created_at": now,
            "updated_at": now,
            "responded_at": None,
        }
        await self._invitations.insert_one(document)
        return DBSpaceInvitation.model_validate(document)

    async def list_pending_invitations_for_user(self, user_id: str) -> list[DBSpaceInvitation]:
        await self._ensure_indexes()
        cursor = self._invitations.find(
            {
                "invitee_user_id": user_id,
                "status": SpaceInvitationStatus.PENDING.value,
            }
        ).sort("created_at", DESCENDING)
        return [DBSpaceInvitation.model_validate(document) async for document in cursor]

    async def get_invitation_by_id(self, invitation_id: str) -> Optional[DBSpaceInvitation]:
        await self._ensure_indexes()
        return self._to_invitation(await self._invitations.find_one({"id": invitation_id}))

    async def update_invitation_status(
        self,
        invitation_id: str,
        status: SpaceInvitationStatus,
        space_id: Optional[str] = None,
    ) -> Optional[DBSpaceInvitation]:
        await self._ensure_indexes()
        now = datetime.now(timezone.utc)
        result = await self._invitations.find_one_and_update(
            {"id": invitation_id},
            {
                "$set": {
                    "status": status.value,
                    "space_id": space_id,
                    "updated_at": now,
                    "responded_at": now,
                }
            },
            return_document=ReturnDocument.AFTER,
        )
        return self._to_invitation(result)

    @staticmethod
    def _to_space(document: Optional[dict]) -> Optional[DBSpace]:
        if document is None:
            return None
        return DBSpace.model_validate(document)

    @staticmethod
    def _to_invitation(document: Optional[dict]) -> Optional[DBSpaceInvitation]:
        if document is None:
            return None
        return DBSpaceInvitation.model_validate(document)
