import { apiRequest } from './client';
import type { CreateMessagePayload, MessageResponse, RoomScopeInput } from './types';

export function listMessages(spaceId: string, roomScope: RoomScopeInput, limit = 50) {
  const params = new URLSearchParams({
    room_scope: roomScope,
    limit: String(limit),
  });
  return apiRequest<MessageResponse[]>(`/spaces/${spaceId}/messages?${params.toString()}`);
}

export function createMessage(spaceId: string, payload: CreateMessagePayload) {
  return apiRequest<MessageResponse>(`/spaces/${spaceId}/messages`, {
    method: 'POST',
    body: payload,
  });
}

