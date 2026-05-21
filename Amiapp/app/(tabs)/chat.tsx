import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MoreHorizontal, SendHorizontal, Sparkles } from 'lucide-react-native';

import {
  ClayButton,
  ClayInput,
  ClaySegmentedControl,
  ClaySurface,
  GeneratedAsset,
  RelationshipAvatar,
  SoftBackground,
} from '@/components/AppleClay';
import { AMI_DEFAULT_SPACE_ID, isBackendApiConfigured } from '@/lib/api/config';
import { useBackendChatStore } from '@/store/useBackendChatStore';
import { useSpaceStore } from '@/store/useSpaceStore';
import { useAmiMockStore } from '@/store/useAmiMockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { clay, clayShadow, clayText } from '@/theme/appleClay';

export default function ChatScreen() {
  const [draft, setDraft] = useState('');
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const routeSpaceId = Array.isArray(params.spaceId) ? params.spaceId[0] : params.spaceId;
  const selectedSpaceId = useSpaceStore((state) => state.selectedSpaceId);
  const selectSpace = useSpaceStore((state) => state.selectSpace);
  const authStatus = useAuthStore((state) => state.status);
  const activeSpaceId = routeSpaceId || selectedSpaceId || AMI_DEFAULT_SPACE_ID;
  const backendChatEnabled = authStatus === 'authenticated' && isBackendApiConfigured() && Boolean(activeSpaceId);
  const mock = useAmiMockStore();
  const backendChatMode = useBackendChatStore((state) => state.chatMode);
  const backendMessages = useBackendChatStore((state) => state.messages);
  const backendIsSending = useBackendChatStore((state) => state.isSending);
  const backendIsStreaming = useBackendChatStore((state) => state.isStreaming);
  const backendError = useBackendChatStore((state) => state.error);
  const backendConnectionState = useBackendChatStore((state) => state.connectionState);
  const backendSetChatMode = useBackendChatStore((state) => state.setChatMode);
  const backendLoadMessages = useBackendChatStore((state) => state.loadMessages);
  const backendSendMessage = useBackendChatStore((state) => state.sendMessage);
  const backendConnectEvents = useBackendChatStore((state) => state.connectEvents);
  const {
    chatMode,
    messages,
    isTyping,
  } = backendChatEnabled
    ? {
        chatMode: backendChatMode,
        messages: backendMessages,
        isTyping: backendIsSending || backendIsStreaming,
      }
    : {
        chatMode: mock.chatMode,
        messages: mock.messages,
        isTyping: mock.isTyping,
      };

  const room = getRoomPresentation(chatMode);

  useEffect(() => {
    if (!backendChatEnabled || !activeSpaceId) {
      return undefined;
    }

    if (routeSpaceId) {
      selectSpace(routeSpaceId);
    }
    void backendLoadMessages(activeSpaceId);
    return backendConnectEvents(activeSpaceId);
  }, [activeSpaceId, backendChatEnabled, backendConnectEvents, backendLoadMessages, routeSpaceId, selectSpace]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => chatMode === 'group' || message.role !== 'partner'),
    [chatMode, messages],
  );

  const handleSend = (text = draft) => {
    if (backendChatEnabled && activeSpaceId) {
      void backendSendMessage(activeSpaceId, text);
    } else {
      mock.sendMessage(text);
    }
    setDraft('');
  };

  const handleModeChange = (mode: typeof chatMode) => {
    if (backendChatEnabled) {
      backendSetChatMode(mode);
    } else {
      mock.setChatMode(mode);
    }
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="px-5 pb-3 pt-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <RelationshipAvatar asset="ami" size={52} />
                <View className="ml-3">
                  <Text className="text-3xl leading-9" style={clayText.display}>
                    {room.title}
                  </Text>
                  <Text className="text-sm font-bold" style={[clayText.body, { color: room.accent }]}>
                    {room.subtitle}
                  </Text>
                </View>
              </View>
              <Pressable className="h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: clay.color.card }}>
                <MoreHorizontal color={clay.color.ink} size={24} strokeWidth={2.6} />
              </Pressable>
            </View>

            <View className="mt-5">
              <ClaySegmentedControl
                value={chatMode}
                onChange={handleModeChange}
                options={[
                  { label: '只和 Ami 聊', value: 'agent' },
                  { label: '三人关系群聊', value: 'group' },
                ]}
              />
            </View>

            <View className="mt-3 rounded-[22px] px-4 py-3" style={{ backgroundColor: room.noticeBackground }}>
              <Text className="text-xs font-extrabold tracking-wide" style={[clayText.title, { color: room.accent }]}>
                {room.eyebrow}
              </Text>
              <Text className="mt-1 text-sm leading-5" style={[clayText.body, { color: clay.color.muted }]}>
                {room.notice}
              </Text>
            </View>

            {backendChatEnabled ? (
              <View className="mt-3 rounded-[20px] px-4 py-3" style={{ backgroundColor: backendError ? '#FFF0F4' : '#EFFAF6' }}>
                <Text className="text-xs font-extrabold" style={[clayText.body, { color: backendError ? clay.color.roseDeep : clay.color.celadonDeep }]}>
                  {backendError ? `连接提示：${backendError}` : `后端消息与 SSE 事件流：${connectionStateLabel(backendConnectionState)}`}
                </Text>
              </View>
            ) : null}
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18 }}
            showsVerticalScrollIndicator={false}
          >
            {visibleMessages.map((message) => {
              const mine = message.role === 'me';
              const agent = message.role === 'agent';
              return (
                <View key={message.id} className={`mb-5 flex-row ${mine ? 'justify-end' : 'justify-start'}`}>
                  {!mine ? <RelationshipAvatar asset={agent ? 'ami' : 'couple'} size={42} /> : null}
                  <View className={`${mine ? 'ml-10 items-end' : 'ml-3 flex-1 items-start'}`}>
                    <View className="mb-1 flex-row items-center">
                      <Text className="text-xs font-extrabold" style={[clayText.title, { color: agent ? clay.color.lavenderDeep : clay.color.muted }]}>
                        {message.sender}
                      </Text>
                      <Text className="ml-2 text-xs" style={clayText.body}>
                        {message.createdAt}
                      </Text>
                    </View>
                    <ClaySurface
                      tone={mine ? 'lavender' : agent ? 'card' : 'clear'}
                      radius={26}
                      className="max-w-[286px] px-4 py-3"
                      style={mine ? { backgroundColor: room.mineBubble, borderColor: 'rgba(255,255,255,0.45)' } : undefined}
                    >
                      <Text className="text-[16px] leading-6" style={[clayText.body, { color: mine ? clay.color.white : clay.color.ink }]}>
                        {message.content}
                      </Text>
                    </ClaySurface>
                    <Pressable
                      onPress={() => {
                        if (!backendChatEnabled) {
                          mock.toggleReaction(message.id);
                        }
                      }}
                      className="mt-2 min-h-[30px] flex-row items-center rounded-full px-3"
                      style={{ backgroundColor: message.reacted ? '#FFF0F4' : 'rgba(255,255,255,0.62)' }}
                    >
                      <Heart
                        color={message.reacted ? clay.color.roseDeep : clay.color.subtle}
                        fill={message.reacted ? clay.color.roseDeep : 'transparent'}
                        size={14}
                      />
                      <Text className="ml-1 text-xs font-bold" style={[clayText.body, { color: clay.color.muted }]}>
                        {message.reactionCount}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            {isTyping ? (
              <View className="mb-5 flex-row items-center">
                <RelationshipAvatar asset="ami" size={42} />
                <ClaySurface className="ml-3 px-4 py-3" radius={24}>
                  <Text className="text-[15px] font-bold" style={[clayText.body, { color: clay.color.lavenderDeep }]}>
                    {chatMode === 'group' ? 'Ami 正在组织一段适合三个人看的回复...' : 'Ami 正在组织一句只给你的回复...'}
                  </Text>
                </ClaySurface>
              </View>
            ) : null}

            <ClaySurface className="mt-2 px-5 py-5" radius={34}>
              <View className="flex-row items-start">
                <GeneratedAsset asset="calendar" size={92} rounded={28} />
                <View className="ml-4 flex-1">
                  <View className="flex-row items-center">
                    <Sparkles color={clay.color.lavenderDeep} size={18} />
                    <Text className="ml-2 text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                      DATE PLAN
                    </Text>
                  </View>
                  <Text className="mt-2 text-[21px] leading-7" style={clayText.display}>
                    {mock.datePlan.title}
                  </Text>
                  <Text className="mt-2 text-[14px] leading-5" style={clayText.body}>
                    {mock.datePlan.subtitle}
                  </Text>
                </View>
              </View>
              <View className="mt-4 flex-row flex-wrap">
                {mock.datePlan.items.map((item) => (
                  <View key={item} className="mb-2 mr-2 rounded-full px-3 py-2" style={{ backgroundColor: clay.color.lavenderSoft }}>
                    <Text className="text-xs font-bold" style={[clayText.body, { color: clay.color.ink }]}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="mt-2 flex-row gap-3">
                <ClayButton className="flex-1" variant="secondary" onPress={() => handleSend('我想把预算再压低一点')}>
                  调整偏好
                </ClayButton>
                <ClayButton className="flex-1" onPress={mock.acceptDatePlan} disabled={mock.datePlan.accepted}>
                  {mock.datePlan.accepted ? '已确认' : '确认计划'}
                </ClayButton>
              </View>
            </ClaySurface>
          </ScrollView>

          <View className="mb-[82px] px-5 pb-3 pt-2" style={{ backgroundColor: room.inputAreaBackground }}>
            {chatMode === 'group' ? (
              <View className="mb-3 rounded-[20px] px-4 py-3" style={{ backgroundColor: '#FFF7D7' }}>
                <Text className="text-xs font-extrabold" style={[clayText.body, { color: clay.color.butterDeep }]}>
                  群聊消息会被双方看到，也会进入共享关系上下文。
                </Text>
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {mock.quickReplies.map((reply) => (
                <Pressable
                  key={reply}
                  onPress={() => handleSend(reply)}
                  className="mr-2 min-h-[38px] justify-center rounded-full px-4"
                  style={({ pressed }) => [
                    { backgroundColor: clay.color.card, transform: [{ scale: pressed ? 0.96 : 1 }] },
                    clayShadow.soft,
                  ]}
                >
                  <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.ink }]}>
                    {reply}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View className="flex-row items-center gap-3">
              <ClayInput className="flex-1" value={draft} onChangeText={setDraft} placeholder={room.placeholder} />
              <ClayButton className="h-[50px] w-[54px] px-0" onPress={() => handleSend()} icon={<SendHorizontal color={clay.color.white} size={20} />} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function getRoomPresentation(chatMode: 'agent' | 'group') {
  if (chatMode === 'group') {
    return {
      title: '三人关系群聊',
      subtitle: '你、对方与 Ami 在同一个共享空间',
      eyebrow: 'SHARED ROOM',
      notice: '这里的消息双方都能看到，Ami 只会使用共享关系上下文，不会带出任何私聊内容。',
      placeholder: '输入适合三个人一起看的话...',
      accent: clay.color.celadonDeep,
      noticeBackground: '#EFFAF6',
      inputAreaBackground: 'rgba(239,250,246,0.78)',
      mineBubble: clay.color.celadonDeep,
    };
  }

  return {
    title: '只和 Ami 聊',
    subtitle: '这一页只属于你和 Ami',
    eyebrow: 'PRIVATE ROOM',
    notice: '私聊内容只用于你的个人上下文，不会同步给对方，也不会出现在群聊回复里。',
    placeholder: '输入只想让 Ami 听见的话...',
    accent: clay.color.lavenderDeep,
    noticeBackground: clay.color.lavenderSoft,
    inputAreaBackground: 'rgba(246,243,251,0.78)',
    mineBubble: clay.color.lavender,
  };
}

function connectionStateLabel(state: 'connecting' | 'open' | 'reconnecting' | 'closed') {
  if (state === 'open') return '已连接';
  if (state === 'reconnecting') return '重连中';
  if (state === 'connecting') return '连接中';
  return '已关闭';
}
