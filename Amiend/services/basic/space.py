"""Relationship space workflows."""

from __future__ import annotations

from core.exceptions import ConflictError, PermissionDeniedError, ResourceNotFoundError
from infrastructure.models.space import (
    AgentProfile,
    CreateSpaceInvitationRequest,
    SpaceInvitationResponse,
    SpaceInvitationStatus,
    SpaceResponse,
    SpaceStatus,
    UpdateAgentProfileRequest,
)
from infrastructure.repositories.space_repository import SpaceRepository
from infrastructure.repositories.user_repository import UserRepository


class SpaceService:
    """Business logic for relationship spaces and invitations."""

    def __init__(
        self,
        space_repository: SpaceRepository,
        user_repository: UserRepository,
    ) -> None:
        self._space_repository = space_repository
        self._user_repository = user_repository

    async def list_spaces(self, current_user_id: str) -> list[SpaceResponse]:
        spaces = await self._space_repository.list_spaces_for_user(current_user_id)
        return [SpaceResponse.from_db(space) for space in spaces]

    async def get_space(self, space_id: str, current_user_id: str) -> SpaceResponse:
        space = await self._require_space_member(space_id, current_user_id)
        return SpaceResponse.from_db(space)

    async def create_invitation(
        self,
        payload: CreateSpaceInvitationRequest,
        current_user_id: str,
    ) -> SpaceInvitationResponse:
        invitee = await self._user_repository.get_by_phone(payload.phone)
        if invitee is None or not invitee.is_active:
            raise ResourceNotFoundError(message="Invitee user not found.")
        if invitee.id == current_user_id:
            raise ConflictError(message="Cannot invite yourself.")

        existing_space = await self._space_repository.get_active_space_between(
            current_user_id,
            invitee.id,
        )
        if existing_space is not None:
            raise ConflictError(message="An active relationship space already exists.")

        existing_invitation = await self._space_repository.get_pending_invitation(
            current_user_id,
            invitee.id,
        )
        if existing_invitation is not None:
            return SpaceInvitationResponse.from_db(existing_invitation)

        reverse_invitation = await self._space_repository.get_pending_invitation(
            invitee.id,
            current_user_id,
        )
        if reverse_invitation is not None:
            raise ConflictError(message="The invitee has already sent you a pending invitation.")

        invitation = await self._space_repository.create_invitation(
            initiator_user_id=current_user_id,
            invitee_user_id=invitee.id,
            invitee_phone=invitee.phone,
            message=payload.message,
        )
        return SpaceInvitationResponse.from_db(invitation)

    async def list_inbox_invitations(self, current_user_id: str) -> list[SpaceInvitationResponse]:
        invitations = await self._space_repository.list_pending_invitations_for_user(current_user_id)
        return [SpaceInvitationResponse.from_db(invitation) for invitation in invitations]

    async def accept_invitation(
        self,
        invitation_id: str,
        current_user_id: str,
    ) -> SpaceInvitationResponse:
        invitation = await self._require_pending_invitation(invitation_id)
        if invitation.invitee_user_id != current_user_id:
            raise PermissionDeniedError(message="Only the invitee can accept this invitation.")

        space = await self._space_repository.get_active_space_between(
            invitation.initiator_user_id,
            invitation.invitee_user_id,
        )
        if space is None:
            space = await self._space_repository.create_space(
                initiator_user_id=invitation.initiator_user_id,
                invitee_user_id=invitation.invitee_user_id,
            )

        updated = await self._space_repository.update_invitation_status(
            invitation_id=invitation.id,
            status=SpaceInvitationStatus.ACCEPTED,
            space_id=space.id,
        )
        if updated is None:
            raise ResourceNotFoundError(message="Invitation not found.")
        return SpaceInvitationResponse.from_db(updated)

    async def reject_invitation(
        self,
        invitation_id: str,
        current_user_id: str,
    ) -> SpaceInvitationResponse:
        invitation = await self._require_pending_invitation(invitation_id)
        if invitation.invitee_user_id != current_user_id:
            raise PermissionDeniedError(message="Only the invitee can reject this invitation.")

        updated = await self._space_repository.update_invitation_status(
            invitation_id=invitation.id,
            status=SpaceInvitationStatus.REJECTED,
        )
        if updated is None:
            raise ResourceNotFoundError(message="Invitation not found.")
        return SpaceInvitationResponse.from_db(updated)

    async def update_agent_profile(
        self,
        space_id: str,
        payload: UpdateAgentProfileRequest,
        current_user_id: str,
    ) -> SpaceResponse:
        space = await self._require_space_member(space_id, current_user_id)
        profile = AgentProfile(
            name=payload.name or space.agent_profile.name,
            tone=payload.tone or space.agent_profile.tone,
        )
        updated = await self._space_repository.update_agent_profile(space_id, profile)
        if updated is None:
            raise ResourceNotFoundError(message="Space not found.")
        return SpaceResponse.from_db(updated)

    async def _require_space_member(self, space_id: str, user_id: str):
        space = await self._space_repository.get_space_by_id(space_id)
        if space is None or space.status != SpaceStatus.ACTIVE:
            raise ResourceNotFoundError(message="Space not found.")
        if user_id not in space.member_ids:
            raise PermissionDeniedError(message="You are not a member of this space.")
        return space

    async def _require_pending_invitation(self, invitation_id: str):
        invitation = await self._space_repository.get_invitation_by_id(invitation_id)
        if invitation is None:
            raise ResourceNotFoundError(message="Invitation not found.")
        if invitation.status != SpaceInvitationStatus.PENDING:
            raise ConflictError(message="Invitation is not pending.")
        return invitation
