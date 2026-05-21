export type RoomScopeInput = 'PRIVATE_SELF' | 'SHARED';
export type ResolvedRoomScope = 'SHARED' | `PRIVATE:${string}`;
export type MessageSenderType = 'USER' | 'AGENT' | 'SYSTEM';
export type SpaceStatus = 'ACTIVE' | 'DISSOLVED';
export type SpaceInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type VerificationScene = 'register' | 'login' | 'account_delete';

export type TokenPair = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
};

export type UserResponse = {
  id: string;
  username: string;
  email: string;
  phone: string | null;
  preferred_name: string;
  is_active: boolean;
  email_verified_at: string | null;
  phone_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailVerificationResponse = {
  outcome: 'login' | 'ticket';
  token_pair?: TokenPair | null;
  verification_ticket?: string | null;
  ticket_expires_at?: string | null;
};

export type AgentProfile = {
  name: string;
  tone: string;
};

export type SpaceMember = {
  user_id: string;
  joined_at: string;
  role: 'INITIATOR' | 'INVITEE';
};

export type SpaceResponse = {
  id: string;
  members: SpaceMember[];
  member_ids: string[];
  agent_profile: AgentProfile;
  status: SpaceStatus;
  created_at: string;
  updated_at: string;
};

export type SpaceInvitationResponse = {
  id: string;
  initiator_user_id: string;
  invitee_user_id: string;
  invitee_phone: string;
  invitee_contact: string;
  message: string;
  status: SpaceInvitationStatus;
  space_id: string | null;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

export type MessageResponse = {
  id: string;
  space_id: string;
  sender_type: MessageSenderType;
  sender_id: string | null;
  room_scope: ResolvedRoomScope;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CreateMessagePayload = {
  room_scope: RoomScopeInput;
  content: string;
  metadata?: Record<string, unknown>;
};

export type SpaceEventName =
  | 'connected'
  | 'heartbeat'
  | 'message.created'
  | 'message.delta'
  | 'message.completed'
  | 'message.failed'
  | 'invitation.updated'
  | 'space.updated'
  | 'memory.digest.completed';

export type SpaceEvent<TData = Record<string, unknown>> = {
  id: string;
  event: SpaceEventName | string;
  data: TData;
};

export type MessageEventData = {
  space_id: string;
  message_id?: string;
  room_scope: ResolvedRoomScope;
  sender_type: MessageSenderType;
  sender_id: string | null;
  message?: MessageResponse;
  chunk?: string;
  error?: string;
};
