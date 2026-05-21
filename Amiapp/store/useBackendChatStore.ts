import { create } from 'zustand';

import { createMessage, listMessages, openSpaceEventStream } from '@/lib/api';
import type {
  MessageEventData,
  MessageResponse,
  RoomScopeInput,
  SpaceEvent,
  SpaceEventConnection,
  SpaceEventConnectionState,
} from '@/lib/api';
import type { ChatMessage, ChatMode, MessageRole } from './useAmiMockStore';
import { useAuthStore } from './useAuthStore';

type BackendChatStore = {
  chatMode: ChatMode;
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  isStreaming: boolean;
  connectionState: SpaceEventConnectionState;
  error: string | null;
  activeSpaceId: string | null;
  setChatMode: (mode: ChatMode) => void;
  loadMessages: (spaceId: string) => Promise<void>;
  sendMessage: (spaceId: string, content: string) => Promise<void>;
  connectEvents: (spaceId: string) => () => void;
  clearError: () => void;
};

type StoreSet = (
  partial: Partial<BackendChatStore> | ((state: BackendChatStore) => Partial<BackendChatStore>),
  replace?: false,
) => void;
type StoreGet = () => BackendChatStore;

let activeConnection: SpaceEventConnection | null = null;

export const useBackendChatStore = create<BackendChatStore>((set, get) => ({
  chatMode: 'group',
  messages: [],
  isLoading: false,
  isSending: false,
  isStreaming: false,
  connectionState: 'closed',
  error: null,
  activeSpaceId: null,
  setChatMode: (mode) => {
    set({ chatMode: mode });
    const { activeSpaceId } = get();
    if (activeSpaceId) {
      void get().loadMessages(activeSpaceId);
    }
  },
  loadMessages: async (spaceId) => {
    set({ isLoading: true, activeSpaceId: spaceId, error: null });
    try {
      const response = await listMessages(spaceId, roomScopeForMode(get().chatMode));
      set({
        messages: response.map(mapBackendMessage),
        isLoading: false,
      });
    } catch (error) {
      set({ error: readErrorMessage(error), isLoading: false });
    }
  },
  sendMessage: async (spaceId, content) => {
    const text = content.trim();
    if (!text) {
      return;
    }

    set({ isSending: true, error: null });
    try {
      const message = await createMessage(spaceId, {
        room_scope: roomScopeForMode(get().chatMode),
        content: text,
      });
      set((state) => ({
        messages: upsertMessage(state.messages, mapBackendMessage(message)),
        isSending: false,
        isStreaming: true,
      }));
    } catch (error) {
      set({ error: readErrorMessage(error), isSending: false });
    }
  },
  connectEvents: (spaceId) => {
    activeConnection?.close();
    activeConnection = openSpaceEventStream(spaceId, {
      onEvent: (event) => handleSpaceEvent(event, set, get),
      onError: (error) => set({ error: error.message, isStreaming: false }),
      onConnectionState: (connectionState) => set({ connectionState }),
    });

    return () => {
      activeConnection?.close();
      activeConnection = null;
    };
  },
  clearError: () => set({ error: null }),
}));

function handleSpaceEvent(
  event: SpaceEvent,
  set: StoreSet,
  get: StoreGet,
) {
  if (event.event === 'message.delta') {
    const data = event.data as MessageEventData;
    if (!isCurrentRoomEvent(data, get().chatMode)) {
      return;
    }
    set((state) => ({
      messages: upsertStreamingMessage(state.messages, data),
      isStreaming: true,
    }));
    return;
  }

  if (event.event === 'message.created' || event.event === 'message.completed') {
    const data = event.data as MessageEventData;
    if (!data.message || !isCurrentRoomEvent(data, get().chatMode)) {
      return;
    }
    set((state) => ({
      messages: upsertMessage(
        state.messages.filter((message) => message.id !== streamingMessageId(data.room_scope)),
        mapBackendMessage(data.message as MessageResponse),
      ),
      isStreaming: event.event === 'message.completed' ? false : state.isStreaming,
    }));
    return;
  }

  if (event.event === 'message.failed') {
    const data = event.data as MessageEventData;
    if (!isCurrentRoomEvent(data, get().chatMode)) {
      return;
    }
    set({ error: data.error ?? 'Ami 回复失败', isStreaming: false });
  }
}

function mapBackendMessage(message: MessageResponse): ChatMessage {
  return {
    id: message.id,
    role: roleForMessage(message),
    sender: senderForMessage(message),
    content: message.content,
    createdAt: formatMessageTime(message.created_at),
    reactionCount: 0,
    reacted: false,
  };
}

function roleForMessage(message: MessageResponse): MessageRole {
  const currentUserId = useAuthStore.getState().user?.id;
  if (message.sender_type === 'AGENT') {
    return 'agent';
  }
  if (message.sender_id && currentUserId && message.sender_id !== currentUserId) {
    return 'partner';
  }
  return 'me';
}

function senderForMessage(message: MessageResponse) {
  const currentUserId = useAuthStore.getState().user?.id;
  if (message.sender_type === 'AGENT') {
    return 'Ami';
  }
  if (message.sender_id && currentUserId && message.sender_id !== currentUserId) {
    return '对方';
  }
  return '我';
}

function upsertMessage(messages: ChatMessage[], next: ChatMessage) {
  const exists = messages.some((message) => message.id === next.id);
  if (exists) {
    return messages.map((message) => (message.id === next.id ? next : message));
  }
  return [...messages, next];
}

function upsertStreamingMessage(messages: ChatMessage[], data: MessageEventData) {
  const id = streamingMessageId(data.room_scope);
  const chunk = data.chunk ?? '';
  const existing = messages.find((message) => message.id === id);
  const streamingMessage: ChatMessage = {
    id,
    role: 'agent',
    sender: 'Ami',
    content: existing ? existing.content + chunk : chunk,
    createdAt: '正在输入',
    reactionCount: 0,
    reacted: false,
  };
  return upsertMessage(messages, streamingMessage);
}

function streamingMessageId(roomScope: string) {
  return `streaming:${roomScope}`;
}

function roomScopeForMode(mode: ChatMode): RoomScopeInput {
  return mode === 'group' ? 'SHARED' : 'PRIVATE_SELF';
}

function isCurrentRoomEvent(data: MessageEventData, mode: ChatMode) {
  const expected = roomScopeForMode(mode);
  if (expected === 'SHARED') {
    return data.room_scope === 'SHARED';
  }
  return data.room_scope !== 'SHARED';
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
