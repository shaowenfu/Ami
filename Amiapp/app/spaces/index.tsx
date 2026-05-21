import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Bell, ChevronRight, HeartHandshake, Inbox, Plus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClayButton, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { isBackendApiConfigured } from '@/lib/api/config';
import { useSpaceStore } from '@/store/useSpaceStore';
import { clay, clayShadow, clayText } from '@/theme/appleClay';

export default function SpacesScreen() {
  const spaces = useSpaceStore((state) => state.spaces);
  const invitations = useSpaceStore((state) => state.invitations);
  const selectedSpaceId = useSpaceStore((state) => state.selectedSpaceId);
  const isLoading = useSpaceStore((state) => state.isLoading);
  const error = useSpaceStore((state) => state.error);
  const loadSpaces = useSpaceStore((state) => state.loadSpaces);
  const loadInvitations = useSpaceStore((state) => state.loadInvitations);
  const selectSpace = useSpaceStore((state) => state.selectSpace);

  useEffect(() => {
    void loadSpaces();
    void loadInvitations();
  }, [loadInvitations, loadSpaces]);

  const openSpace = (spaceId: string) => {
    selectSpace(spaceId);
    router.push(`/space/${spaceId}/chat` as Href);
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
          <View className="pb-4 pt-2">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-[34px] leading-10" style={clayText.display}>
                  关系空间
                </Text>
                <Text className="mt-2 text-[15px] leading-6" style={clayText.body}>
                  从全局层进入不同关系，私聊和群聊会在空间内保持隔离。
                </Text>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-full" style={[{ backgroundColor: clay.color.card }, clayShadow.soft]}>
                <Bell color={clay.color.lavenderDeep} size={22} strokeWidth={2.5} />
              </View>
            </View>

            <ClaySurface className="mt-6 px-5 py-5" radius={30} tone={isBackendApiConfigured() ? 'celadon' : 'lavender'}>
              <View className="flex-row items-center">
                <GeneratedAsset asset="ami" size={72} rounded={24} />
                <View className="ml-4 flex-1">
                  <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                    {isBackendApiConfigured() ? 'API 已配置' : '本地演示模式'}
                  </Text>
                  <Text className="mt-1 text-[18px] leading-6" style={clayText.display}>
                    {isBackendApiConfigured() ? '可以读取真实空间与消息' : '配置 .env 后切换到真实后端'}
                  </Text>
                </View>
              </View>
            </ClaySurface>
          </View>

          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-xl" style={clayText.display}>
              我的空间
            </Text>
            <ClayButton
              variant="tonal"
              className="min-h-[40px] px-4"
              icon={<Plus color={clay.color.lavenderDeep} size={16} />}
              onPress={() => router.push('/spaces/create' as Href)}
            >
              创建
            </ClayButton>
          </View>

          {error ? (
            <View className="mt-3 rounded-[20px] px-4 py-3" style={{ backgroundColor: '#FFF0F4' }}>
              <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.roseDeep }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <View className="mt-3">
            {spaces.map((space) => {
              const selected = selectedSpaceId === space.id;
              return (
                <ClaySurface
                  key={space.id}
                  className="mb-4 px-5 py-5"
                  radius={30}
                  tone={selected ? 'lavender' : 'card'}
                  onPress={() => openSpace(space.id)}
                >
                  <View className="flex-row items-center">
                    <View className="h-14 w-14 items-center justify-center rounded-[22px]" style={{ backgroundColor: clay.color.card }}>
                      <HeartHandshake color={selected ? clay.color.lavenderDeep : clay.color.celadonDeep} size={26} strokeWidth={2.5} />
                    </View>
                    <View className="ml-4 flex-1">
                      <Text className="text-[20px] leading-7" style={clayText.display}>
                        {space.title}
                      </Text>
                      <Text className="mt-1 text-sm leading-5" style={clayText.body}>
                        {space.subtitle}
                      </Text>
                      <Text className="mt-2 text-xs font-extrabold" style={[clayText.body, { color: clay.color.subtle }]}>
                        {space.memberCount} 位成员 · 更新于 {space.updatedAt}
                      </Text>
                    </View>
                    <ChevronRight color={clay.color.subtle} size={22} strokeWidth={2.6} />
                  </View>
                </ClaySurface>
              );
            })}
          </View>

          <Pressable
            onPress={() => router.push('/spaces/invitations' as Href)}
            className="mt-1 min-h-[58px] flex-row items-center rounded-[24px] px-4"
            style={({ pressed }) => [
              { backgroundColor: clay.color.card, transform: [{ scale: pressed ? 0.98 : 1 }] },
              clayShadow.soft,
            ]}
          >
            <Inbox color={clay.color.roseDeep} size={22} strokeWidth={2.6} />
            <Text className="ml-3 flex-1 text-[16px] font-extrabold" style={clayText.title}>
              邀请信箱
            </Text>
            <Text className="text-sm font-extrabold" style={[clayText.body, { color: clay.color.muted }]}>
              {isLoading ? '同步中' : `${invitations.length} 条待处理`}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}
