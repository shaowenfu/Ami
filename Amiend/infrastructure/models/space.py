"""Relationship space and invitation models."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from infrastructure.models.user import DBUser


class SpaceStatus(str, Enum):
    """Lifecycle state for a relationship space."""

    ACTIVE = "ACTIVE"
    DISSOLVED = "DISSOLVED"


class SpaceMemberRole(str, Enum):
    """Role assigned when a user joins a relationship space."""

    INITIATOR = "INITIATOR"
    INVITEE = "INVITEE"


class SpaceInvitationStatus(str, Enum):
    """Lifecycle state for a relationship invitation."""

    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class AgentProfile(BaseModel):
    """Space-local Ami profile."""

    name: str = Field(default="Ami", min_length=1, max_length=40)
    self_recognition: str = Field(default="", max_length=4000)
    prompt: str = Field(default="", max_length=4000)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned

    @field_validator("self_recognition", "prompt")
    @classmethod
    def strip_optional_text(cls, value: str) -> str:
        return value.strip()


class SpaceMember(BaseModel):
    """A user in a relationship space."""

    user_id: str
    joined_at: datetime
    role: SpaceMemberRole


class SpaceMemberProfile(BaseModel):
    """Public profile for a member inside a relationship space."""

    user_id: str
    username: str = ""
    preferred_name: str = ""
    avatar_url: str = ""

    @classmethod
    def from_user(cls, user: DBUser) -> "SpaceMemberProfile":
        return cls(
            user_id=user.id,
            username=user.username,
            preferred_name=user.preferred_name,
            avatar_url=user.avatar_url,
        )


class DBSpace(BaseModel):
    """Internal MongoDB representation of a relationship space."""

    id: str
    members: list[SpaceMember]
    member_ids: list[str]
    agent_profile: AgentProfile
    user_a_profile: str = Field(default="", max_length=8000)
    user_b_profile: str = Field(default="", max_length=8000)
    relationship_summary: str = Field(default="", max_length=8000)
    status: SpaceStatus
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class DBSpaceInvitation(BaseModel):
    """Internal MongoDB representation of a relationship invitation."""

    id: str
    initiator_user_id: str
    invitee_user_id: str
    invitee_phone: str = ""
    invitee_contact: str = ""
    message: str = ""
    status: SpaceInvitationStatus
    space_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    responded_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
    }


class CreateSpaceInvitationRequest(BaseModel):
    """Payload for inviting another user into a relationship space."""

    identifier: Optional[str] = Field(default=None, min_length=3, max_length=254)
    phone: Optional[str] = Field(default=None, min_length=6, max_length=20)
    message: str = Field(default="", max_length=240)

    @field_validator("identifier", "phone")
    @classmethod
    def strip_identifier(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        return value.strip()

    @model_validator(mode="after")
    def ensure_identifier(self) -> "CreateSpaceInvitationRequest":
        if not (self.identifier or self.phone):
            raise ValueError("identifier cannot be empty")
        if self.identifier is None and self.phone is not None:
            self.identifier = self.phone
        return self


class UpdateAgentProfileRequest(BaseModel):
    """Payload for updating the space-local Ami profile."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=40)
    self_recognition: Optional[str] = Field(default=None, max_length=4000)
    prompt: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("name")
    @classmethod
    def strip_optional_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name cannot be empty")
        return cleaned

    @field_validator("self_recognition", "prompt")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return value.strip()


class SpaceResponse(BaseModel):
    """Public relationship space payload."""

    id: str
    members: list[SpaceMember]
    member_ids: list[str]
    member_profiles: list[SpaceMemberProfile] = Field(default_factory=list)
    agent_profile: AgentProfile
    user_a_profile: str = ""
    user_b_profile: str = ""
    relationship_summary: str = ""
    status: SpaceStatus
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_db(cls, space: DBSpace) -> "SpaceResponse":
        return cls.model_validate(space.model_dump())


class SpaceInvitationResponse(BaseModel):
    """Public invitation payload."""

    id: str
    initiator_user_id: str
    invitee_user_id: str
    invitee_phone: str = ""
    invitee_contact: str = ""
    message: str
    status: SpaceInvitationStatus
    space_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    responded_at: Optional[datetime]

    @classmethod
    def from_db(cls, invitation: DBSpaceInvitation) -> "SpaceInvitationResponse":
        return cls.model_validate(invitation.model_dump())
