import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { ArrowLeft, Mail, UserPlus } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClayButton, ClayInput, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { useAuthStore } from '@/store/useAuthStore';
import { clay, clayText } from '@/theme/appleClay';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const sendEmailCode = useAuthStore((state) => state.sendEmailCode);
  const register = useAuthStore((state) => state.register);
  const busy = status === 'checking';

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/spaces' as Href);
    }
  }, [status]);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = async () => {
    if (!email.trim() || cooldown > 0) {
      return;
    }
    setLocalError(null);
    await sendEmailCode(email, 'register');
    setCooldown(60);
  };

  const submit = async () => {
    setLocalError(null);
    if (password !== confirmPassword) {
      setLocalError('两次输入的密码不一致。');
      return;
    }
    const ok = await register({
      email,
      code,
      username,
      phone,
      password,
    });
    if (ok) {
      router.replace('/spaces' as Href);
    }
  };

  const visibleError = localError || error;

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

            <ClaySurface className="px-5 py-6" radius={34} tone="celadon">
              <View className="flex-row items-center">
                <GeneratedAsset asset="couple" size={88} rounded={28} />
                <View className="ml-4 flex-1">
                  <Text className="text-[32px] leading-9" style={clayText.display}>
                    创建 Ami 账号
                  </Text>
                  <Text className="mt-2 text-[15px] leading-6" style={clayText.body}>
                    用邮箱验证码完成注册，手机号可稍后补充。
                  </Text>
                </View>
              </View>
            </ClaySurface>

            <View className="mt-6">
              <Text className="mb-2 ml-1 text-sm font-extrabold" style={clayText.title}>
                邮箱
              </Text>
              <ClayInput value={email} onChangeText={setEmail} placeholder="输入邮箱" keyboardType="email-address" autoCapitalize="none" />

              <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                验证码
              </Text>
              <View className="flex-row gap-3">
                <ClayInput className="flex-1" value={code} onChangeText={setCode} placeholder="6 位验证码" keyboardType="number-pad" />
                <ClayButton
                  variant="secondary"
                  className="min-h-[50px] px-4"
                  disabled={busy || cooldown > 0 || !email.trim()}
                  icon={<Mail color={clay.color.celadonDeep} size={16} />}
                  onPress={() => void requestCode()}
                >
                  {cooldown > 0 ? `${cooldown}s` : '获取'}
                </ClayButton>
              </View>

              <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                用户名
              </Text>
              <ClayInput value={username} onChangeText={setUsername} placeholder="至少 3 个字符" autoCapitalize="none" />

              <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                手机号
              </Text>
              <ClayInput value={phone} onChangeText={setPhone} placeholder="选填，用于关系邀请" keyboardType="phone-pad" />

              <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                密码
              </Text>
              <ClayInput value={password} onChangeText={setPassword} placeholder="至少 6 位，包含符号" secureTextEntry />

              <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                确认密码
              </Text>
              <ClayInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="再次输入密码" secureTextEntry />
            </View>

            {visibleError ? (
              <View className="mt-5 rounded-[20px] px-4 py-3" style={{ backgroundColor: '#FFF0F4' }}>
                <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.roseDeep }]}>
                  {visibleError}
                </Text>
              </View>
            ) : null}

            <ClayButton
              className="mt-6"
              disabled={busy || !email.trim() || !code.trim() || !username.trim() || !password || !confirmPassword}
              icon={<UserPlus color={clay.color.white} size={18} />}
              onPress={() => void submit()}
            >
              {busy ? '创建中...' : '注册并进入'}
            </ClayButton>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SoftBackground>
  );
}
