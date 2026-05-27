import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { ArrowLeft, Check, MailOpen, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClayButton, ClaySurface, SoftBackground } from '@/components/AppleClay';
import { useAuthStore } from '@/store/useAuthStore';
import { useSpaceStore } from '@/store/useSpaceStore';
import { clay, clayText } from '@/theme/appleClay';

export default function InvitationsScreen() {
  const invitations = useSpaceStore((state) => state.invitations);
  const isLoading = useSpaceStore((state) => state.isLoading);
  const error = useSpaceStore((state) => state.error);
  const loadInvitations = useSpaceStore((state) => state.loadInvitations);
  const acceptInvitation = useSpaceStore((state) => state.acceptInvitation);
  const rejectInvitation = useSpaceStore((state) => state.rejectInvitation);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/auth/login' as Href);
      return;
    }
    if (status !== 'authenticated') {
      return;
    }
    void loadInvitations();
  }, [loadInvitations, status]);

  const handleAccept = async (invitationId: string) => {
    const invitation = await acceptInvitation(invitationId);
    if (invitation?.space_id) {
      router.replace('/spaces' as Href);
    }
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
          <View className="flex-row items-center justify-between pb-4 pt-2">
            <ClayButton variant="secondary" className="h-11 min-h-[44px] px-4" icon={<ArrowLeft color={clay.color.ink} size={18} />} onPress={() => router.back()}>
              返回
            </ClayButton>
          </View>

          <Text className="text-[34px] leading-10" style={clayText.display}>
            邀请信箱
          </Text>
          <Text className="mt-2 text-[15px] leading-6" style={clayText.body}>
            接受邀请后，双方会进入同一个关系空间；拒绝不会创建 Space。
          </Text>

          {error ? (
            <View className="mt-5 rounded-[20px] px-4 py-3" style={{ backgroundColor: '#FFF0F4' }}>
              <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.roseDeep }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <View className="mt-6">
            {invitations.length === 0 ? (
              <ClaySurface className="items-center px-5 py-8" radius={32}>
                <MailOpen color={clay.color.lavenderDeep} size={34} strokeWidth={2.4} />
                <Text className="mt-4 text-[20px] leading-7" style={clayText.display}>
                  {isLoading ? '正在同步邀请...' : '暂时没有待处理邀请'}
                </Text>
                <Text className="mt-2 text-center text-sm leading-5" style={clayText.body}>
                  新邀请会出现在这里，接受后就能进入对应关系空间。
                </Text>
              </ClaySurface>
            ) : null}

            {invitations.map((invitation) => (
              <ClaySurface key={invitation.id} className="mb-4 px-5 py-5" radius={30} tone="card">
                <Text className="text-[20px] leading-7" style={clayText.display}>
                  来自 {invitation.initiator_user_id}
                </Text>
                <Text className="mt-2 text-sm leading-5" style={clayText.body}>
                  {invitation.message || '对方邀请你一起建立 Ami 关系空间。'}
                </Text>
                <Text className="mt-3 text-xs font-extrabold" style={[clayText.body, { color: clay.color.subtle }]}>
                  发送至 {invitation.invitee_contact || invitation.invitee_phone}
                </Text>
                <View className="mt-4 flex-row gap-3">
                  <ClayButton
                    className="flex-1"
                    variant="secondary"
                    icon={<X color={clay.color.roseDeep} size={16} />}
                    disabled={isLoading}
                    onPress={() => void rejectInvitation(invitation.id)}
                  >
                    拒绝
                  </ClayButton>
                  <ClayButton
                    className="flex-1"
                    variant="tonal"
                    icon={<Check color={clay.color.lavenderDeep} size={16} />}
                    disabled={isLoading}
                    onPress={() => void handleAccept(invitation.id)}
                  >
                    接受
                  </ClayButton>
                </View>
              </ClaySurface>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}
