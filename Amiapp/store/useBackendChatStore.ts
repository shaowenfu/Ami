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
  messagesByRoom: Record<string, ChatMessage[]>;
  loadedRooms: Record<string, boolean>;
  pendingAgentRooms: Record<string, boolean>;
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
  messagesByRoom: {},
  loadedRooms: {},
  pendingAgentRooms: {},
  isLoading: false,
  isSending: false,
  isStreaming: false,
  connectionState: 'closed',
  error: null,
  activeSpaceId: null,
  setChatMode: (mode) => {
    const { activeSpaceId, messagesByRoom } = get();
    const roomKey = activeSpaceId ? cacheKey(activeSpaceId, mode) : null;
    set({
      chatMode: mode,
      messages: roomKey ? messagesByRoom[roomKey] ?? [] : [],
    });
    if (activeSpaceId) {
      const key = cacheKey(activeSpaceId, mode);
      if (!get().loadedRooms[key]) {
        void get().loadMessages(activeSpaceId);
      }
    }
  },
  loadMessages: async (spaceId) => {
    const mode = get().chatMode;
    const key = cacheKey(spaceId, mode);
    const cached = get().messagesByRoom[key] ?? [];
    set({ isLoading: !get().loadedRooms[key], activeSpaceId: spaceId, messages: cached, error: null });
    try {
      const response = await listMessages(spaceId, roomScopeForMode(mode));
      const messages = response.map(mapBackendMessage);
      set((state) => ({
        messagesByRoom: { ...state.messagesByRoom, [key]: messages },
        loadedRooms: { ...state.loadedRooms, [key]: true },
        messages: state.activeSpaceId === spaceId && state.chatMode === mode ? messages : state.messages,
        isLoading: false,
      }));
    } catch (error) {
      set({ error: readErrorMessage(error), isLoading: false });
    }
  },
  sendMessage: async (spaceId, content) => {
    const text = content.trim();
    if (!text) {
      return;
    }

    const mode = get().chatMode;
    const scope = roomScopeForMode(mode);
    const key = cacheKey(spaceId, mode);
    const optimisticId = `optimistic:${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      role: 'me',
      sender: '我',
      content: text,
      createdAt: formatMessageTime(new Date().toISOString()),
      reactionCount: 0,
      reacted: false,
    };

    set((state) => ({
      isSending: true,
      error: null,
      messages: [...(state.messagesByRoom[key] ?? state.messages), optimisticMessage],
      messagesByRoom: {
        ...state.messagesByRoom,
        [key]: [...(state.messagesByRoom[key] ?? state.messages), optimisticMessage],
      },
      pendingAgentRooms: { ...state.pendingAgentRooms, [key]: true },
    }));
    try {
      const message = await createMessage(spaceId, {
        room_scope: scope,
        content: text,
      });
      set((state) => ({
        messages:
          state.activeSpaceId === spaceId && state.chatMode === mode
            ? replaceOrUpsertMessage(state.messages, optimisticId, mapBackendMessage(message))
            : state.messages,
        messagesByRoom: {
          ...state.messagesByRoom,
          [key]: replaceOrUpsertMessage(state.messagesByRoom[key] ?? [], optimisticId, mapBackendMessage(message)),
        },
        loadedRooms: { ...state.loadedRooms, [key]: true },
        isSending: false,
        isStreaming: state.pendingAgentRooms[key] ?? true,
      }));
    } catch (error) {
      set((state) => ({
        error: readErrorMessage(error),
        isSending: false,
        pendingAgentRooms: { ...state.pendingAgentRooms, [key]: false },
      }));
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
    const key = cacheKey(get().activeSpaceId ?? data.space_id, modeForRoomScope(data.room_scope));
    set((state) => ({
      messages: upsertStreamingMessage(state.messages, data),
      messagesByRoom: {
        ...state.messagesByRoom,
        [key]: upsertStreamingMessage(state.messagesByRoom[key] ?? [], data),
      },
      pendingAgentRooms: { ...state.pendingAgentRooms, [key]: true },
      isStreaming: true,
    }));
    return;
  }

  if (event.event === 'message.created' || event.event === 'message.completed') {
    const data = event.data as MessageEventData;
    if (!data.message || !isCurrentRoomEvent(data, get().chatMode)) {
      return;
    }
    const message = data.message as MessageResponse;
    const key = cacheKey(get().activeSpaceId ?? message.space_id, modeForRoomScope(data.room_scope));
    set((state) => ({
      messages: upsertMessage(
        state.messages.filter((message) => message.id !== streamingMessageId(data.room_scope)),
        mapBackendMessage(message),
      ),
      messagesByRoom: {
        ...state.messagesByRoom,
        [key]: upsertMessage(
          (state.messagesByRoom[key] ?? []).filter((message) => message.id !== streamingMessageId(data.room_scope)),
          mapBackendMessage(message),
        ),
      },
      loadedRooms: { ...state.loadedRooms, [key]: true },
      pendingAgentRooms: message.sender_type === 'AGENT' ? { ...state.pendingAgentRooms, [key]: false } : state.pendingAgentRooms,
      isStreaming: event.event === 'message.completed' ? false : state.isStreaming,
    }));
    return;
  }

  if (event.event === 'message.failed') {
    const data = event.data as MessageEventData;
    if (!isCurrentRoomEvent(data, get().chatMode)) {
      return;
    }
    const key = cacheKey(get().activeSpaceId ?? data.space_id, modeForRoomScope(data.room_scope));
    set((state) => ({
      error: data.error ?? 'Ami 回复失败',
      isStreaming: false,
      pendingAgentRooms: { ...state.pendingAgentRooms, [key]: false },
    }));
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

function replaceOrUpsertMessage(messages: ChatMessage[], optimisticId: string, next: ChatMessage) {
  const replaced = messages.some((message) => message.id === optimisticId);
  if (replaced) {
    return messages
      .filter((message) => message.id === optimisticId || message.id !== next.id)
      .map((message) => (message.id === optimisticId ? next : message));
  }
  return upsertMessage(messages, next);
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

function modeForRoomScope(roomScope: string): ChatMode {
  return roomScope === 'SHARED' ? 'group' : 'agent';
}

function cacheKey(spaceId: string, mode: ChatMode) {
  return `${spaceId}:${mode}`;
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
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
