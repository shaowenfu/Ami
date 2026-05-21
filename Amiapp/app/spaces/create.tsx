import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { ArrowLeft, SendHorizontal } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClayButton, ClayInput, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { isBackendApiConfigured } from '@/lib/api/config';
import { useSpaceStore } from '@/store/useSpaceStore';
import { clay, clayText } from '@/theme/appleClay';

export default function CreateSpaceScreen() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('想邀请你和我一起建立一个 Ami 关系空间。');
  const isLoading = useSpaceStore((state) => state.isLoading);
  const error = useSpaceStore((state) => state.error);
  const createInvitation = useSpaceStore((state) => state.createInvitation);

  const handleSubmit = async () => {
    const invitation = await createInvitation(phone, message);
    if (invitation) {
      router.push('/spaces' as Href);
    }
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center justify-between pb-4 pt-2">
              <ClayButton variant="secondary" className="h-11 min-h-[44px] px-4" icon={<ArrowLeft color={clay.color.ink} size={18} />} onPress={() => router.back()}>
                返回
              </ClayButton>
            </View>

            <ClaySurface className="px-5 py-6" radius={34} tone="lavender">
              <View className="flex-row items-center">
                <GeneratedAsset asset="couple" size={92} rounded={30} />
                <View className="ml-4 flex-1">
                  <Text className="text-[30px] leading-9" style={clayText.display}>
                    创建关系空间
                  </Text>
                  <Text className="mt-2 text-[15px] leading-6" style={clayText.body}>
                    先用手机号发出邀请，对方接受后你们会进入同一个 Space。
                  </Text>
                </View>
              </View>
            </ClaySurface>

            <View className="mt-6">
              <Text className="mb-2 ml-1 text-sm font-extrabold" style={clayText.title}>
                对方手机号
              </Text>
              <ClayInput value={phone} onChangeText={setPhone} placeholder="输入已注册手机号" keyboardType="phone-pad" />

              <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                邀请留言
              </Text>
              <ClayInput
                value={message}
                onChangeText={setMessage}
                placeholder="写一句想一起进入空间的话"
                multiline
                style={{ minHeight: 104, alignItems: 'flex-start', paddingTop: 14 }}
              />
            </View>

            {error ? (
              <View className="mt-5 rounded-[20px] px-4 py-3" style={{ backgroundColor: '#FFF0F4' }}>
                <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.roseDeep }]}>
                  {error}
                </Text>
              </View>
            ) : null}

            {!isBackendApiConfigured() ? (
              <View className="mt-5 rounded-[20px] px-4 py-3" style={{ backgroundColor: clay.color.lavenderSoft }}>
                <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.lavenderDeep }]}>
                  当前是演示模式。配置 `EXPO_PUBLIC_AMI_ACCESS_TOKEN` 后会发送真实邀请。
                </Text>
              </View>
            ) : null}

            <ClayButton className="mt-6" disabled={isLoading || !phone.trim()} icon={<SendHorizontal color={clay.color.white} size={18} />} onPress={handleSubmit}>
              {isLoading ? '发送中...' : '发送邀请'}
            </ClayButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SoftBackground>
  );
}
