import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronRight, LockKeyhole, LogOut, Moon, ShieldAlert, Sparkles } from 'lucide-react-native';

import { CheckPill, ClayButton, ClayInput, ClayModal, ClaySurface, GeneratedAsset, RelationshipAvatar, SoftBackground } from '@/components/AppleClay';
import { useAmiMockStore, type ProfileSetting } from '@/store/useAmiMockStore';
import { useAuthStore } from '@/store/useAuthStore';
import { clay, clayShadow, clayText } from '@/theme/appleClay';

const settingIcon = {
  notifications: Bell,
  privacy: LockKeyhole,
  gentleNudge: Moon,
} satisfies Record<ProfileSetting['id'], typeof Bell>;

export default function ProfileScreen() {
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const {
    moods,
    todayMoodId,
    wishes,
    moments,
    anniversaries,
    datePlan,
    profileSettings,
    setTodayMood,
    toggleProfileSetting,
  } = useAmiMockStore();
  const user = useAuthStore((state) => state.user);
  const authError = useAuthStore((state) => state.error);
  const logout = useAuthStore((state) => state.logout);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const todayMood = moods.find((mood) => mood.id === todayMoodId) ?? moods[0];

  const submitDelete = async () => {
    const ok = await deleteAccount({ password: deletePassword });
    if (ok) {
      setDeleteVisible(false);
      setDeletePassword('');
    }
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 116 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-5 mt-7 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <RelationshipAvatar asset="couple" size={74} />
              <View className="ml-4">
                <View className="flex-row items-center">
                  <Text className="text-[30px] leading-9" style={clayText.display}>
                    小鹿
                  </Text>
                  <View className="ml-2 rounded-full px-3 py-1" style={{ backgroundColor: clay.color.lavender }}>
                    <Text className="text-xs font-black text-white">LV.6</Text>
                  </View>
                </View>
                <Text className="mt-1 text-[15px] font-bold" style={clayText.body}>
                  与泽明相伴第 520 天
                </Text>
              </View>
            </View>
            <ChevronRight color={clay.color.ink} size={25} strokeWidth={2.5} />
          </View>

          <ClaySurface className="mb-5 px-5 py-5" radius={36}>
            <View className="flex-row items-center justify-between">
              <RelationshipAvatar asset="couple" size={74} label="我们" />
              <View className="items-center px-4">
                <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: clay.color.lavenderSoft }}>
                  <Sparkles color={clay.color.lavenderDeep} size={27} strokeWidth={2.5} />
                </View>
                <Text className="mt-2 text-center text-xs font-bold" style={clayText.body}>
                  Ami 正在陪伴
                </Text>
              </View>
              <RelationshipAvatar asset="ami" size={74} label="Ami" />
            </View>
          </ClaySurface>

          <ClaySurface className="mb-5 px-5 py-5" radius={34} style={{ backgroundColor: todayMood.color }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-sm font-extrabold" style={[clayText.title, { color: clay.color.ink }]}>
                  今日心情
                </Text>
                <Text className="mt-2 text-[28px] leading-9" style={clayText.display}>
                  {todayMood.label}
                </Text>
                <Text className="mt-2 text-[15px] leading-6" style={[clayText.body, { color: clay.color.ink }]}>
                  {todayMood.value}
                </Text>
              </View>
              <GeneratedAsset asset="memory" size={86} rounded={30} />
            </View>
            <View className="mt-4 flex-row flex-wrap">
              {moods.map((mood) => (
                <CheckPill key={mood.id} active={mood.id === todayMoodId} label={mood.label} onPress={() => setTodayMood(mood.id)} />
              ))}
            </View>
          </ClaySurface>

          <View className="mb-5 flex-row gap-3">
            {[
              { value: wishes.filter((wish) => wish.done).length, label: '已实现' },
              { value: moments.length, label: '共同瞬间' },
              { value: anniversaries.length, label: '纪念日' },
            ].map((stat) => (
              <ClaySurface key={stat.label} className="flex-1 items-center px-2 py-4" radius={28} tone="clear">
                <Text className="text-2xl" style={clayText.display}>
                  {stat.value}
                </Text>
                <Text className="mt-1 text-center text-xs font-bold" style={clayText.body}>
                  {stat.label}
                </Text>
              </ClaySurface>
            ))}
          </View>

          <ClaySurface className="mb-5 px-5 py-5" radius={34}>
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-4">
                <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                  当前关系计划
                </Text>
                <Text className="mt-2 text-[22px] leading-7" style={clayText.display}>
                  {datePlan.title}
                </Text>
                <Text className="mt-2 text-[14px] leading-5" style={clayText.body}>
                  {datePlan.accepted ? '已经确认，Ami 会在合适的时间轻轻提醒。' : '还在等待你们一起确认。'}
                </Text>
              </View>
              <View className="rounded-full px-3 py-2" style={{ backgroundColor: datePlan.accepted ? clay.color.celadon : clay.color.lavenderSoft }}>
                <Text className="text-xs font-black" style={{ color: datePlan.accepted ? clay.color.celadonDeep : clay.color.lavenderDeep }}>
                  {datePlan.accepted ? '已确认' : '待确认'}
                </Text>
              </View>
            </View>
          </ClaySurface>

          <ClaySurface className="px-3 py-2" radius={34}>
            {profileSettings.map((setting) => {
              const Icon = settingIcon[setting.id];
              return (
                <Pressable
                  key={setting.id}
                  onPress={() => toggleProfileSetting(setting.id)}
                  className="my-1 flex-row items-center rounded-[26px] px-3 py-4"
                  style={({ pressed }) => [
                    { backgroundColor: setting.enabled ? 'rgba(237,231,255,0.82)' : 'rgba(255,255,255,0.42)' },
                    { transform: [{ scale: pressed ? 0.985 : 1 }] },
                  ]}
                >
                  <View className="mr-4 h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: clay.color.card }}>
                    <Icon color={setting.enabled ? clay.color.lavenderDeep : clay.color.subtle} size={23} strokeWidth={2.5} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[18px]" style={clayText.display}>
                      {setting.title}
                    </Text>
                    <Text className="mt-1 text-[13px] leading-5" style={clayText.body}>
                      {setting.subtitle}
                    </Text>
                  </View>
                  <View
                    className="h-8 w-14 justify-center rounded-full px-1"
                    style={[{ backgroundColor: setting.enabled ? clay.color.lavender : clay.color.line }, clayShadow.soft]}
                  >
                    <View
                      className="h-6 w-6 rounded-full bg-white"
                      style={{ transform: [{ translateX: setting.enabled ? 22 : 0 }] }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </ClaySurface>

          <ClayButton className="mt-5" variant="secondary">
            编辑关系资料
          </ClayButton>

          <ClaySurface className="mt-5 px-5 py-5" radius={34} tone="clear">
            <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
              账号安全
            </Text>
            <Text className="mt-2 text-[20px] leading-7" style={clayText.display}>
              {user?.email || user?.username || '当前账号'}
            </Text>
            <Text className="mt-2 text-sm leading-5" style={clayText.body}>
              Token 保存在客户端安全存储中，退出登录会清除本机 refresh token。
            </Text>
            {authError ? (
              <Text className="mt-3 text-sm font-bold" style={[clayText.body, { color: clay.color.roseDeep }]}>
                {authError}
              </Text>
            ) : null}
            <View className="mt-4 flex-row gap-3">
              <ClayButton className="flex-1" variant="secondary" icon={<LogOut color={clay.color.ink} size={16} />} onPress={() => void logout()}>
                退出
              </ClayButton>
              <ClayButton className="flex-1" variant="ghost" icon={<ShieldAlert color={clay.color.roseDeep} size={16} />} onPress={() => setDeleteVisible(true)}>
                注销
              </ClayButton>
            </View>
          </ClaySurface>

          <ClayModal visible={deleteVisible} title="注销账号" onClose={() => setDeleteVisible(false)}>
            <Text className="text-sm leading-5" style={clayText.body}>
              注销会停用当前账号，并撤销所有刷新令牌。
            </Text>
            <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
              当前密码
            </Text>
            <ClayInput value={deletePassword} onChangeText={setDeletePassword} placeholder="输入密码确认注销" secureTextEntry />
            <ClayButton className="mt-5" variant="ghost" disabled={!deletePassword} onPress={() => void submitDelete()}>
              确认注销
            </ClayButton>
          </ClayModal>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}
