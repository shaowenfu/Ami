import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { KeyRound, Mail, SendHorizontal } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClayButton, ClayInput, ClaySegmentedControl, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { useAuthStore } from '@/store/useAuthStore';
import { clay, clayText } from '@/theme/appleClay';

type LoginMode = 'password' | 'code';

export default function LoginScreen() {
  const [mode, setMode] = useState<LoginMode>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const sendEmailCode = useAuthStore((state) => state.sendEmailCode);
  const login = useAuthStore((state) => state.login);
  const loginWithEmailCode = useAuthStore((state) => state.loginWithEmailCode);
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
    await sendEmailCode(email, 'login');
    setCooldown(60);
  };

  const submit = async () => {
    const ok = mode === 'password' ? await login(identifier, password) : await loginWithEmailCode(email, code);
    if (ok) {
      router.replace('/spaces' as Href);
    }
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
            <View className="pt-8">
              <ClaySurface className="px-5 py-6" radius={34} tone="lavender">
                <View className="flex-row items-center">
                  <GeneratedAsset asset="ami" size={86} rounded={28} />
                  <View className="ml-4 flex-1">
                    <Text className="text-[34px] leading-10" style={clayText.display}>
                      欢迎回来
                    </Text>
                    <Text className="mt-2 text-[15px] leading-6" style={clayText.body}>
                      登录后继续进入你的关系空间。
                    </Text>
                  </View>
                </View>
              </ClaySurface>

              <View className="mt-6">
                <ClaySegmentedControl
                  value={mode}
                  onChange={setMode}
                  options={[
                    { label: '密码登录', value: 'password' },
                    { label: '邮箱验证码', value: 'code' },
                  ]}
                />
              </View>

              {mode === 'password' ? (
                <View className="mt-6">
                  <Text className="mb-2 ml-1 text-sm font-extrabold" style={clayText.title}>
                    邮箱 / 手机号 / 用户名
                  </Text>
                  <ClayInput value={identifier} onChangeText={setIdentifier} placeholder="输入账号" autoCapitalize="none" />

                  <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                    密码
                  </Text>
                  <ClayInput value={password} onChangeText={setPassword} placeholder="输入密码" secureTextEntry />
                </View>
              ) : (
                <View className="mt-6">
                  <Text className="mb-2 ml-1 text-sm font-extrabold" style={clayText.title}>
                    邮箱
                  </Text>
                  <ClayInput value={email} onChangeText={setEmail} placeholder="输入注册邮箱" keyboardType="email-address" autoCapitalize="none" />

                  <Text className="mb-2 ml-1 mt-5 text-sm font-extrabold" style={clayText.title}>
                    验证码
                  </Text>
                  <View className="flex-row gap-3">
                    <ClayInput className="flex-1" value={code} onChangeText={setCode} placeholder="6 位验证码" keyboardType="number-pad" />
                    <ClayButton
                      variant="secondary"
                      className="min-h-[50px] px-4"
                      disabled={busy || cooldown > 0 || !email.trim()}
                      icon={<Mail color={clay.color.lavenderDeep} size={16} />}
                      onPress={() => void requestCode()}
                    >
                      {cooldown > 0 ? `${cooldown}s` : '获取'}
                    </ClayButton>
                  </View>
                </View>
              )}

              {error ? (
                <View className="mt-5 rounded-[20px] px-4 py-3" style={{ backgroundColor: '#FFF0F4' }}>
                  <Text className="text-sm font-bold" style={[clayText.body, { color: clay.color.roseDeep }]}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <ClayButton
                className="mt-6"
                disabled={busy || (mode === 'password' ? !identifier.trim() || !password : !email.trim() || !code.trim())}
                icon={mode === 'password' ? <KeyRound color={clay.color.white} size={18} /> : <SendHorizontal color={clay.color.white} size={18} />}
                onPress={() => void submit()}
              >
                {busy ? '验证中...' : '登录'}
              </ClayButton>

              <ClayButton className="mt-4" variant="secondary" onPress={() => router.push('/auth/register' as Href)}>
                创建新账号
              </ClayButton>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SoftBackground>
  );
}
