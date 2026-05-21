import { create } from 'zustand';

import {
  acceptSpaceInvitation,
  createSpaceInvitation,
  listInboxInvitations,
  listSpaces,
  rejectSpaceInvitation,
} from '@/lib/api/spaces';
import type { SpaceInvitationResponse, SpaceResponse } from '@/lib/api/types';

export type SpaceSummary = {
  id: string;
  title: string;
  subtitle: string;
  memberCount: number;
  status: 'ACTIVE' | 'DISSOLVED';
  updatedAt: string;
};

type SpaceStore = {
  spaces: SpaceSummary[];
  invitations: SpaceInvitationResponse[];
  selectedSpaceId: string | null;
  isLoading: boolean;
  error: string | null;
  loadSpaces: () => Promise<void>;
  loadInvitations: () => Promise<void>;
  createInvitation: (identifier: string, message: string) => Promise<SpaceInvitationResponse | null>;
  acceptInvitation: (invitationId: string) => Promise<void>;
  rejectInvitation: (invitationId: string) => Promise<void>;
  selectSpace: (spaceId: string) => void;
};

const demoSpaces: SpaceSummary[] = [
  {
    id: 'demo-space',
    title: '小鹿和泽明',
    subtitle: 'Ami 正在守护你们的关系节奏',
    memberCount: 2,
    status: 'ACTIVE',
    updatedAt: '今天',
  },
];
const defaultSelectedSpaceId = demoSpaces[0]?.id || null;

export const useSpaceStore = create<SpaceStore>((set) => ({
  spaces: demoSpaces,
  invitations: [],
  selectedSpaceId: defaultSelectedSpaceId,
  isLoading: false,
  error: null,
  loadSpaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const spaces = await listSpaces();
      const summaries = spaces.map(mapSpaceSummary);
      set((state) => ({
        spaces: summaries,
        selectedSpaceId: state.selectedSpaceId ?? summaries[0]?.id ?? null,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: readErrorMessage(error), isLoading: false });
    }
  },
  loadInvitations: async () => {
    try {
      const invitations = await listInboxInvitations();
      set({ invitations });
    } catch (error) {
      set({ error: readErrorMessage(error) });
    }
  },
  createInvitation: async (identifier, message) => {
    set({ isLoading: true, error: null });
    try {
      const invitation = await createSpaceInvitation({ identifier, message });
      set((state) => ({
        invitations: upsertInvitation(state.invitations, invitation),
        isLoading: false,
      }));
      return invitation;
    } catch (error) {
      set({ error: readErrorMessage(error), isLoading: false });
      return null;
    }
  },
  acceptInvitation: async (invitationId) => {
    set({ isLoading: true, error: null });
    try {
      const invitation = await acceptSpaceInvitation(invitationId);
      const spaces = await listSpaces();
      const summaries = spaces.map(mapSpaceSummary);
      set({
        invitations: [],
        spaces: summaries,
        selectedSpaceId: invitation.space_id ?? summaries[0]?.id ?? null,
        isLoading: false,
      });
    } catch (error) {
      set({ error: readErrorMessage(error), isLoading: false });
    }
  },
  rejectInvitation: async (invitationId) => {
    set({ isLoading: true, error: null });
    try {
      const invitation = await rejectSpaceInvitation(invitationId);
      set((state) => ({
        invitations: state.invitations.filter((item) => item.id !== invitation.id),
        isLoading: false,
      }));
    } catch (error) {
      set({ error: readErrorMessage(error), isLoading: false });
    }
  },
  selectSpace: (spaceId) => set({ selectedSpaceId: spaceId }),
}));

function mapSpaceSummary(space: SpaceResponse): SpaceSummary {
  return {
    id: space.id,
    title: space.agent_profile.name || 'Ami Space',
    subtitle: `${space.member_ids.length} 位成员 · ${space.agent_profile.tone}`,
    memberCount: space.member_ids.length,
    status: space.status,
    updatedAt: formatDateLabel(space.updated_at),
  };
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '最近';
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function upsertInvitation(invitations: SpaceInvitationResponse[], next: SpaceInvitationResponse) {
  const exists = invitations.some((invitation) => invitation.id === next.id);
  if (exists) {
    return invitations.map((invitation) => (invitation.id === next.id ? next : invitation));
  }
  return [next, ...invitations];
}
