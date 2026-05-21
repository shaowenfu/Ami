import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MoreHorizontal, SendHorizontal } from 'lucide-react-native';

import {
  ClayButton,
  ClayInput,
  ClaySegmentedControl,
  ClaySurface,
  RelationshipAvatar,
  SoftBackground,
} from '@/components/AppleClay';
import { useBackendChatStore } from '@/store/useBackendChatStore';
import { useSpaceStore } from '@/store/useSpaceStore';
import { clay, clayShadow, clayText } from '@/theme/appleClay';

export default function SpaceChatScreen() {
  const [draft, setDraft] = useState('');
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const routeSpaceId = Array.isArray(params.spaceId) ? params.spaceId[0] : params.spaceId;
  const selectSpace = useSpaceStore((state) => state.selectSpace);
  const activeSpaceId = routeSpaceId;

  const chatMode = useBackendChatStore((state) => state.chatMode);
  const messages = useBackendChatStore((state) => state.messages);
  const isSending = useBackendChatStore((state) => state.isSending);
  const isStreaming = useBackendChatStore((state) => state.isStreaming);
  const error = useBackendChatStore((state) => state.error);
  const connectionState = useBackendChatStore((state) => state.connectionState);
  const setChatMode = useBackendChatStore((state) => state.setChatMode);
  const loadMessages = useBackendChatStore((state) => state.loadMessages);
  const sendMessage = useBackendChatStore((state) => state.sendMessage);
  const connectEvents = useBackendChatStore((state) => state.connectEvents);

  const isTyping = isSending || isStreaming;
  const room = getRoomPresentation(chatMode);

  useEffect(() => {
    if (!activeSpaceId) {
      return undefined;
    }
    selectSpace(activeSpaceId);
    void loadMessages(activeSpaceId);
    return connectEvents(activeSpaceId);
  }, [activeSpaceId, connectEvents, loadMessages, selectSpace]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => chatMode === 'group' || message.role !== 'partner'),
    [chatMode, messages],
  );

  const handleSend = (text = draft) => {
    if (activeSpaceId) {
      void sendMessage(activeSpaceId, text);
    }
    setDraft('');
  };

  const handleModeChange = (mode: typeof chatMode) => {
    setChatMode(mode);
  };

  if (!activeSpaceId) {
    return (
      <SoftBackground>
        <SafeAreaView className="flex-1 items-center justify-center">
          <Text style={clayText.body}>未提供 Space ID</Text>
        </SafeAreaView>
      </SoftBackground>
    );
  }

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

            <View className="mt-3 rounded-[20px] px-4 py-3" style={{ backgroundColor: error ? '#FFF0F4' : '#EFFAF6' }}>
              <Text className="text-xs font-extrabold" style={[clayText.body, { color: error ? clay.color.roseDeep : clay.color.celadonDeep }]}>
                {error ? `连接提示：${error}` : `后端状态：${connectionStateLabel(connectionState)}`}
              </Text>
            </View>
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
                    {/* Interaction removed since mock logic was removed and backend doesn't support reactions yet */}
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

          </ScrollView>

          <View className="mb-[82px] px-5 pb-3 pt-2" style={{ backgroundColor: room.inputAreaBackground }}>
            {chatMode === 'group' ? (
              <View className="mb-3 rounded-[20px] px-4 py-3" style={{ backgroundColor: '#FFF7D7' }}>
                <Text className="text-xs font-extrabold" style={[clayText.body, { color: clay.color.butterDeep }]}>
                  群聊消息会被双方看到，也会进入共享关系上下文。
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-3">
              <ClayInput className="flex-1" value={draft} onChangeText={setDraft} placeholder={room.placeholder} />
              <ClayButton className="h-[50px] w-[54px] px-0" onPress={() => handleSend()} icon={<SendHorizontal color={clay.color.white} size={20} />} disabled={isTyping} />
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
