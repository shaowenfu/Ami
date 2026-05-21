import { apiRequest } from './client';
import type { SpaceInvitationResponse, SpaceResponse } from './types';

export function listSpaces() {
  return apiRequest<SpaceResponse[]>('/spaces');
}

export function getSpace(spaceId: string) {
  return apiRequest<SpaceResponse>(`/spaces/${spaceId}`);
}

export function listInboxInvitations() {
  return apiRequest<SpaceInvitationResponse[]>('/spaces/invitations/inbox');
}

export function createSpaceInvitation(payload: { identifier: string; message?: string }) {
  return apiRequest<SpaceInvitationResponse>('/spaces/invitations', {
    method: 'POST',
    body: payload,
  });
}

export function acceptSpaceInvitation(invitationId: string) {
  return apiRequest<SpaceInvitationResponse>(`/spaces/invitations/${invitationId}/accept`, {
    method: 'POST',
  });
}

export function rejectSpaceInvitation(invitationId: string) {
  return apiRequest<SpaceInvitationResponse>(`/spaces/invitations/${invitationId}/reject`, {
    method: 'POST',
  });
}
