import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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
import { useAmiMockStore } from '@/store/useAmiMockStore';
import { clay, clayShadow, clayText } from '@/theme/appleClay';

export default function ChatScreen() {
  const [draft, setDraft] = useState('');
  const {
    chatMode,
    messages,
    isTyping,
    quickReplies,
    datePlan,
    setChatMode,
    sendMessage,
    toggleReaction,
    acceptDatePlan,
  } = useAmiMockStore();

  const visibleMessages = useMemo(
    () => messages.filter((message) => chatMode === 'group' || message.role !== 'partner'),
    [chatMode, messages],
  );

  const handleSend = (text = draft) => {
    sendMessage(text);
    setDraft('');
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
                    Ami
                  </Text>
                  <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.celadonDeep }]}>
                    正在守护你们的关系节奏
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
                onChange={setChatMode}
                options={[
                  { label: '只和 Ami 聊', value: 'agent' },
                  { label: '三人关系群聊', value: 'group' },
                ]}
              />
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
                      style={mine ? { backgroundColor: clay.color.lavender, borderColor: 'rgba(255,255,255,0.45)' } : undefined}
                    >
                      <Text className="text-[16px] leading-6" style={[clayText.body, { color: mine ? clay.color.white : clay.color.ink }]}>
                        {message.content}
                      </Text>
                    </ClaySurface>
                    <Pressable
                      onPress={() => toggleReaction(message.id)}
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
                    Ami 正在组织一句更温柔的话...
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
                    {datePlan.title}
                  </Text>
                  <Text className="mt-2 text-[14px] leading-5" style={clayText.body}>
                    {datePlan.subtitle}
                  </Text>
                </View>
              </View>
              <View className="mt-4 flex-row flex-wrap">
                {datePlan.items.map((item) => (
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
                <ClayButton className="flex-1" onPress={acceptDatePlan} disabled={datePlan.accepted}>
                  {datePlan.accepted ? '已确认' : '确认计划'}
                </ClayButton>
              </View>
            </ClaySurface>
          </ScrollView>

          <View className="mb-[82px] px-5 pb-3 pt-2" style={{ backgroundColor: 'rgba(246,243,251,0.72)' }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {quickReplies.map((reply) => (
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
              <ClayInput className="flex-1" value={draft} onChangeText={setDraft} placeholder="输入想被好好听见的话..." />
              <ClayButton className="h-[50px] w-[54px] px-0" onPress={() => handleSend()} icon={<SendHorizontal color={clay.color.white} size={20} />} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SoftBackground>
  );
}
