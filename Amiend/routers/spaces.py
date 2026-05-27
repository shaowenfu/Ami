"""Relationship space routes."""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from dependencies.providers import CurrentUserIdDep, SpaceServiceDep
from infrastructure.models.space import (
    CreateSpaceInvitationRequest,
    SpaceInvitationResponse,
    SpaceResponse,
    UpdateAgentProfileRequest,
)


router = APIRouter(prefix="/spaces", tags=["spaces"])


@router.get("", response_model=list[SpaceResponse], summary="查询当前用户的关系空间")
async def list_spaces(
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> list[SpaceResponse]:
    """Return all active spaces the current user belongs to."""

    return await space_service.list_spaces(current_user_id)


@router.post(
    "/invitations",
    response_model=SpaceInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="按手机号邀请用户建立关系空间",
)
async def create_invitation(
    payload: CreateSpaceInvitationRequest,
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> SpaceInvitationResponse:
    """Create or return an existing pending relationship invitation."""

    return await space_service.create_invitation(payload, current_user_id)


@router.get(
    "/invitations/inbox",
    response_model=list[SpaceInvitationResponse],
    summary="查询当前用户收到的待处理邀请",
)
async def list_inbox_invitations(
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> list[SpaceInvitationResponse]:
    """Return pending invitations where the current user is invitee."""

    return await space_service.list_inbox_invitations(current_user_id)


@router.post(
    "/invitations/{invitation_id}/accept",
    response_model=SpaceInvitationResponse,
    summary="接受关系空间邀请",
)
async def accept_invitation(
    invitation_id: str,
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> SpaceInvitationResponse:
    """Accept an invitation and create the relationship space if needed."""

    return await space_service.accept_invitation(invitation_id, current_user_id)


@router.post(
    "/invitations/{invitation_id}/reject",
    response_model=SpaceInvitationResponse,
    summary="拒绝关系空间邀请",
)
async def reject_invitation(
    invitation_id: str,
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> SpaceInvitationResponse:
    """Reject a pending invitation."""

    return await space_service.reject_invitation(invitation_id, current_user_id)


@router.get("/{space_id}", response_model=SpaceResponse, summary="查询关系空间详情")
async def get_space(
    space_id: str,
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> SpaceResponse:
    """Return one relationship space after membership validation."""

    return await space_service.get_space(space_id, current_user_id)


@router.patch(
    "/{space_id}/agent-profile",
    response_model=SpaceResponse,
    summary="更新当前关系空间的 Ami 设定",
)
async def update_agent_profile(
    space_id: str,
    payload: UpdateAgentProfileRequest,
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> SpaceResponse:
    """Update the space-local Ami profile."""

    return await space_service.update_agent_profile(space_id, payload, current_user_id)


@router.delete(
    "/{space_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除关系空间",
    description="仅删除当前关系空间；不会注销任何用户账号。需当前用户是空间成员。",
)
async def delete_space(
    space_id: str,
    space_service: SpaceServiceDep,
    current_user_id: CurrentUserIdDep,
) -> Response:
    """Dissolve a relationship space for all members."""

    await space_service.dissolve_space(space_id, current_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
