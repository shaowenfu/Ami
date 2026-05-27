import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { DoorOpen, ShieldAlert, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClayButton, ClayModal, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { getSpace } from '@/lib/api/spaces';
import { buildApiUrl } from '@/lib/api/config';
import type { SpaceMemberProfile, SpaceResponse } from '@/lib/api/types';
import { useAuthStore } from '@/store/useAuthStore';
import { useSpaceStore } from '@/store/useSpaceStore';
import { clay, clayText } from '@/theme/appleClay';

export default function SpaceProfileScreen() {
  const { spaceId } = useLocalSearchParams<{ spaceId: string }>();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [space, setSpace] = useState<SpaceResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const user = useAuthStore((state) => state.user);
  const error = useSpaceStore((state) => state.error);
  const deleteSpace = useSpaceStore((state) => state.deleteSpace);

  useEffect(() => {
    if (!spaceId) {
      return;
    }
    void getSpace(spaceId)
      .then((next) => {
        setSpace(next);
        setLoadError('');
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
  }, [spaceId]);

  const members = useMemo(() => {
    const profiles = space?.member_profiles ?? [];
    const me = profiles.find((profile) => profile.user_id === user?.id) ?? profiles[0];
    const other = profiles.find((profile) => profile.user_id !== me?.user_id) ?? profiles[1] ?? profiles[0];
    return { me, other };
  }, [space?.member_profiles, user?.id]);

  const submitDelete = async () => {
    if (!spaceId) {
      return;
    }
    const ok = await deleteSpace(spaceId);
    if (ok) {
      setDeleteVisible(false);
      router.replace('/spaces' as Href);
    }
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 116 }} showsVerticalScrollIndicator={false}>
          <View className="mt-7">
            <Text className="text-[30px] leading-9" style={clayText.display}>
              空间主页
            </Text>
            <Text className="mt-2 text-[15px] leading-6" style={clayText.body}>
              当前关系空间的成员与 Ami。
            </Text>
          </View>

          <ClaySurface className="mt-6 px-5 py-6" radius={36}>
            <View className="flex-row items-start justify-between">
              <MemberAvatar member={members.me} fallback="我" />
              <View className="items-center px-3">
                <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: clay.color.lavenderSoft }}>
                  <Sparkles color={clay.color.lavenderDeep} size={27} strokeWidth={2.5} />
                </View>
                <GeneratedAsset asset="ami" size={82} rounded={32} />
                <Text className="mt-2 text-center text-xs font-bold" style={clayText.body}>
                  {space?.agent_profile.name || 'Ami'}
                </Text>
              </View>
              <MemberAvatar member={members.other} fallback="对方" />
            </View>
          </ClaySurface>

          <ClaySurface className="mt-5 px-5 py-5" radius={34} tone="celadon">
            <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.celadonDeep }]}>
              关系空间
            </Text>
            <Text className="mt-2 text-[24px] leading-8" style={clayText.display}>
              {space?.agent_profile.name || 'Ami'}
            </Text>
            <Text className="mt-2 text-sm leading-5" style={clayText.body}>
              {space ? `${space.member_profiles.length || space.member_ids.length} 位成员` : '正在同步成员信息'}
            </Text>
          </ClaySurface>

          {error || loadError ? (
            <Text className="mt-4 rounded-[18px] px-4 py-3 text-sm font-bold" style={[clayText.body, { backgroundColor: '#FFF0F4', color: clay.color.roseDeep }]}>
              {error || loadError}
            </Text>
          ) : null}

          <ClayButton className="mt-5" variant="secondary" icon={<DoorOpen color={clay.color.ink} size={16} />} onPress={() => router.replace('/spaces' as Href)}>
            退出关系空间
          </ClayButton>
          <ClayButton className="mt-3" variant="ghost" icon={<ShieldAlert color={clay.color.roseDeep} size={16} />} onPress={() => setDeleteVisible(true)}>
            删除关系空间
          </ClayButton>

          <ClayModal visible={deleteVisible} title="删除关系空间" onClose={() => setDeleteVisible(false)}>
            <Text className="text-sm leading-5" style={clayText.body}>
              这只会删除当前关系空间和它的空间上下文，不会注销你或对方的账号。
            </Text>
            <ClayButton className="mt-5" variant="ghost" onPress={() => void submitDelete()}>
              确认删除空间
            </ClayButton>
          </ClayModal>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function MemberAvatar({ member, fallback }: { member?: SpaceMemberProfile; fallback: string }) {
  const label = member?.preferred_name || member?.username || fallback;
  return (
    <View className="w-[92px] items-center">
      <View className="h-[82px] w-[82px] overflow-hidden rounded-full" style={{ backgroundColor: clay.color.card }}>
        {member?.avatar_url ? (
          <Image source={{ uri: resolveAvatarUri(member.avatar_url) }} style={{ height: 82, width: 82 }} resizeMode="cover" />
        ) : (
          <GeneratedAsset asset="couple" size={82} rounded={41} />
        )}
      </View>
      <Text className="mt-2 text-center text-xs font-bold" style={clayText.body}>
        {label}
      </Text>
    </View>
  );
}

function resolveAvatarUri(value: string) {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file:')) {
    return value;
  }
  return buildApiUrl(value);
}
