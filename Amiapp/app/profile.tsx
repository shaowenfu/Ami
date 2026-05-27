import { useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { ArrowLeft, Camera, KeyRound, LogOut, Mail, Phone, ShieldAlert, UserRound } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClayButton, ClayInput, ClayModal, ClaySegmentedControl, ClaySurface, GeneratedAsset, SoftBackground } from '@/components/AppleClay';
import { verifyEmailCode, verifySmsCode } from '@/lib/api';
import { buildApiUrl } from '@/lib/api/config';
import { useAuthStore } from '@/store/useAuthStore';
import { clay, clayText } from '@/theme/appleClay';

type DeleteMethod = 'password' | 'code';
type PasswordMethod = 'oldPassword' | 'code';
type ContactTarget = 'email' | 'phone';

export default function GlobalProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const logout = useAuthStore((state) => state.logout);
  const sendEmailCode = useAuthStore((state) => state.sendEmailCode);
  const sendSmsCode = useAuthStore((state) => state.sendSmsCode);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const uploadAvatar = useAuthStore((state) => state.uploadAvatar);
  const updateContact = useAuthStore((state) => state.updateContact);
  const changePassword = useAuthStore((state) => state.changePassword);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const clearError = useAuthStore((state) => state.clearError);

  const [preferredName, setPreferredName] = useState('');
  const [contactVisible, setContactVisible] = useState(false);
  const [contactTarget, setContactTarget] = useState<ContactTarget>('email');
  const [contactValue, setContactValue] = useState('');
  const [contactCode, setContactCode] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordMethod, setPasswordMethod] = useState<PasswordMethod>('oldPassword');
  const [oldPassword, setOldPassword] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteMethod, setDeleteMethod] = useState<DeleteMethod>('password');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (status === 'anonymous') {
      router.replace('/auth/login' as Href);
    }
  }, [status]);

  useEffect(() => {
    setPreferredName(user?.preferred_name || user?.username || '');
  }, [user]);

  const saveProfile = async () => {
    await updateProfile({ preferred_name: preferredName });
  };

  const pickAvatar = async () => {
    setLocalError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLocalError('需要相册权限才能选择头像。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.86,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets[0]) {
      return;
    }
    const asset = result.assets[0];
    const extension = readExtension(asset.uri);
    await uploadAvatar({
      uri: asset.uri,
      name: asset.fileName || `avatar.${extension}`,
      type: asset.mimeType || `image/${extension}`,
    });
  };

  const sendContactCode = async () => {
    if (contactTarget === 'email') {
      await sendEmailCode(contactValue, 'register');
      return;
    }
    await sendSmsCode(contactValue, 'register');
  };

  const submitContact = async () => {
    const ok = await updateContact(contactTarget === 'email' ? { email: contactValue, code: contactCode } : { phone: contactValue, code: contactCode });
    if (ok) {
      setContactVisible(false);
      setContactValue('');
      setContactCode('');
    }
  };

  const sendPasswordCode = async () => {
    if (user?.email) {
      await sendEmailCode(user.email, 'password_change');
      return;
    }
    if (user?.phone) {
      await sendSmsCode(user.phone, 'password_change');
    }
  };

  const submitPassword = async () => {
    setLocalError('');
    if (newPassword !== newPasswordConfirm) {
      setLocalError('两次输入的新密码不一致。');
      return;
    }
    const ok = await changePassword(
      passwordMethod === 'oldPassword'
        ? { oldPassword, newPassword }
        : { code: passwordCode, newPassword },
    );
    if (ok) {
      setPasswordVisible(false);
      setOldPassword('');
      setPasswordCode('');
      setNewPassword('');
      setNewPasswordConfirm('');
    }
  };

  const sendDeleteCode = async () => {
    if (user?.email) {
      await sendEmailCode(user.email, 'account_delete');
      return;
    }
    if (user?.phone) {
      await sendSmsCode(user.phone, 'account_delete');
    }
  };

  const submitDelete = async () => {
    setLocalError('');
    try {
      if (deleteMethod === 'password') {
        await deleteAccount({ password: deletePassword });
        return;
      }
      const ticket = user?.email
        ? (await verifyEmailCode({ email: user.email, code: deleteCode, scene: 'account_delete' })).verification_ticket
        : user?.phone
          ? (await verifySmsCode({ phone: user.phone, code: deleteCode, scene: 'account_delete' })).verification_ticket
          : null;
      if (ticket) {
        await deleteAccount({ verification_ticket: ticket });
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  const openContact = (target: ContactTarget) => {
    clearError();
    setLocalError('');
    setContactTarget(target);
    setContactValue(target === 'email' ? user?.email || '' : user?.phone || '');
    setContactCode('');
    setContactVisible(true);
  };

  return (
    <SoftBackground>
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View className="mt-4 flex-row items-center justify-between">
            <ClayButton variant="secondary" className="h-12 min-h-[48px] px-4" icon={<ArrowLeft color={clay.color.ink} size={18} />} onPress={() => router.replace('/spaces' as Href)}>
              返回
            </ClayButton>
            <Text className="text-[28px]" style={clayText.display}>
              Profile
            </Text>
          </View>

          <ClaySurface className="mt-6 px-5 py-5" radius={34}>
            <View className="flex-row items-center">
              {user?.avatar_url ? (
                <View className="h-[82px] w-[82px] overflow-hidden rounded-full">
                  <Image source={{ uri: resolveAvatarUri(user.avatar_url) }} style={{ height: 82, width: 82 }} resizeMode="cover" />
                </View>
              ) : (
                <GeneratedAsset asset="ami" size={82} rounded={41} />
              )}
              <View className="ml-4 flex-1">
                <Text className="text-xs font-extrabold" style={[clayText.title, { color: clay.color.lavenderDeep }]}>
                  全局身份
                </Text>
                <Text className="mt-1 text-[24px] leading-8" style={clayText.display}>
                  {user?.preferred_name || user?.username || '未命名'}
                </Text>
                <Text className="mt-1 text-sm" style={clayText.body}>
                  这里管理账号本身，不影响单个关系空间的删除。
                </Text>
              </View>
            </View>
          </ClaySurface>

          <ClaySurface className="mt-5 px-5 py-5" radius={34}>
            <Text className="text-lg" style={clayText.display}>
              个人资料
            </Text>
            <Text className="mb-2 ml-1 mt-4 text-sm font-extrabold" style={clayText.title}>
              昵称
            </Text>
            <ClayInput value={preferredName} onChangeText={setPreferredName} placeholder="你希望 Ami 怎么称呼你" />
            <View className="mt-5 flex-row gap-3">
              <ClayButton className="flex-1" variant="secondary" icon={<Camera color={clay.color.ink} size={16} />} onPress={() => void pickAvatar()}>
                选择头像
              </ClayButton>
              <ClayButton className="flex-1" icon={<UserRound color={clay.color.white} size={16} />} onPress={() => void saveProfile()}>
                保存昵称
              </ClayButton>
            </View>
          </ClaySurface>

          <ClaySurface className="mt-5 px-5 py-5" radius={34}>
            <View className="flex-row items-center">
              <KeyRound color={clay.color.lavenderDeep} size={22} />
              <View className="ml-3 flex-1">
                <Text className="text-[18px]" style={clayText.display}>
                  登录密码
                </Text>
                <Text className="mt-1 text-sm" style={clayText.body}>
                  支持通过原密码或验证码修改。
                </Text>
              </View>
            </View>
            <ClayButton className="mt-4" variant="tonal" onPress={() => {
              setLocalError('');
              setPasswordVisible(true);
            }}>
              修改密码
            </ClayButton>
          </ClaySurface>

          <ClaySurface className="mt-5 px-3 py-2" radius={34}>
            {[
              { key: 'email' as const, icon: Mail, title: '绑定邮箱', value: user?.email || '未绑定' },
              { key: 'phone' as const, icon: Phone, title: '绑定手机号', value: user?.phone || '未绑定' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <ClaySurface key={item.key} className="my-1 px-4 py-4" radius={26} tone="clear" onPress={() => openContact(item.key)}>
                  <View className="flex-row items-center">
                    <Icon color={clay.color.lavenderDeep} size={22} />
                    <View className="ml-3 flex-1">
                      <Text className="text-[17px]" style={clayText.display}>
                        {item.title}
                      </Text>
                      <Text className="mt-1 text-sm" style={clayText.body}>
                        {item.value}
                      </Text>
                    </View>
                  </View>
                </ClaySurface>
              );
            })}
          </ClaySurface>

          {error || localError ? (
            <Text className="mt-4 rounded-[18px] px-4 py-3 text-sm font-bold" style={[clayText.body, { backgroundColor: '#FFF0F4', color: clay.color.roseDeep }]}>
              {error || localError}
            </Text>
          ) : null}

          <View className="mt-5 flex-row gap-3">
            <ClayButton className="flex-1" variant="secondary" icon={<LogOut color={clay.color.ink} size={16} />} onPress={() => void logout()}>
              退出登录
            </ClayButton>
            <ClayButton className="flex-1" variant="ghost" icon={<ShieldAlert color={clay.color.roseDeep} size={16} />} onPress={() => {
              setLocalError('');
              setDeleteVisible(true);
            }}>
              注销账号
            </ClayButton>
          </View>

          <ClayModal visible={contactVisible} title={contactTarget === 'email' ? '修改邮箱' : '修改手机号'} onClose={() => setContactVisible(false)}>
            <ClayInput value={contactValue} onChangeText={setContactValue} placeholder={contactTarget === 'email' ? '新邮箱' : '新手机号'} autoCapitalize="none" />
            <View className="mt-3 flex-row gap-3">
              <ClayInput className="flex-1" value={contactCode} onChangeText={setContactCode} placeholder="验证码" keyboardType="number-pad" />
              <ClayButton variant="tonal" onPress={() => void sendContactCode()}>
                发送
              </ClayButton>
            </View>
            <ClayButton className="mt-5" disabled={!contactValue || !contactCode} onPress={() => void submitContact()}>
              完成绑定
            </ClayButton>
          </ClayModal>

          <ClayModal visible={passwordVisible} title="修改密码" onClose={() => setPasswordVisible(false)}>
            <ClaySegmentedControl
              value={passwordMethod}
              onChange={setPasswordMethod}
              options={[
                { label: '原密码', value: 'oldPassword' },
                { label: '验证码', value: 'code' },
              ]}
            />
            {passwordMethod === 'oldPassword' ? (
              <ClayInput className="mt-4" value={oldPassword} onChangeText={setOldPassword} placeholder="输入原密码" secureTextEntry />
            ) : (
              <View className="mt-4 flex-row gap-3">
                <ClayInput className="flex-1" value={passwordCode} onChangeText={setPasswordCode} placeholder="验证码" keyboardType="number-pad" />
                <ClayButton variant="tonal" disabled={!user?.email && !user?.phone} onPress={() => void sendPasswordCode()}>
                  发送
                </ClayButton>
              </View>
            )}
            <ClayInput className="mt-4" value={newPassword} onChangeText={setNewPassword} placeholder="输入新密码" secureTextEntry />
            <ClayInput className="mt-3" value={newPasswordConfirm} onChangeText={setNewPasswordConfirm} placeholder="再次输入新密码" secureTextEntry />
            <ClayButton
              className="mt-5"
              disabled={!newPassword || !newPasswordConfirm || (passwordMethod === 'oldPassword' ? !oldPassword : !passwordCode)}
              onPress={() => void submitPassword()}
            >
              保存新密码
            </ClayButton>
          </ClayModal>

          <ClayModal visible={deleteVisible} title="注销账号" onClose={() => setDeleteVisible(false)}>
            <ClaySegmentedControl
              value={deleteMethod}
              onChange={setDeleteMethod}
              options={[
                { label: '密码', value: 'password' },
                { label: '验证码', value: 'code' },
              ]}
            />
            {deleteMethod === 'password' ? (
              <ClayInput className="mt-4" value={deletePassword} onChangeText={setDeletePassword} placeholder="输入当前密码" secureTextEntry />
            ) : (
              <View className="mt-4 flex-row gap-3">
                <ClayInput className="flex-1" value={deleteCode} onChangeText={setDeleteCode} placeholder="验证码" keyboardType="number-pad" />
                <ClayButton variant="tonal" disabled={!user?.email && !user?.phone} onPress={() => void sendDeleteCode()}>
                  发送
                </ClayButton>
              </View>
            )}
            <Text className="mt-4 text-sm leading-5" style={clayText.body}>
              注销会停用当前账号并撤销所有刷新令牌；关系空间的删除请进入对应空间处理。
            </Text>
            <ClayButton className="mt-5" variant="ghost" disabled={deleteMethod === 'password' ? !deletePassword : !deleteCode} onPress={() => void submitDelete()}>
              确认注销
            </ClayButton>
          </ClayModal>
        </ScrollView>
      </SafeAreaView>
    </SoftBackground>
  );
}

function readExtension(uri: string) {
  const extension = uri.split('.').pop()?.toLowerCase();
  if (!extension || extension.length > 5) {
    return 'jpg';
  }
  return extension === 'jpeg' ? 'jpg' : extension;
}

function resolveAvatarUri(value: string) {
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('file:')) {
    return value;
  }
  return buildApiUrl(value);
}
