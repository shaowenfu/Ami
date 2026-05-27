import { create } from 'zustand';
import { router } from 'expo-router';
import type { Href } from 'expo-router';

import {
  deleteAccount as deleteAccountRequest,
  getMe,
  loginWithPassword,
  logout as logoutRequest,
  registerWithEmail,
  changePassword as changePasswordRequest,
  sendEmailCode as sendEmailCodeRequest,
  sendSmsCode as sendSmsCodeRequest,
  setUnauthorizedHandler,
  updateContact as updateContactRequest,
  updateMe,
  uploadAvatar as uploadAvatarRequest,
  verifyEmailCode,
  verifySmsCode,
} from '@/lib/api';
import { clearStoredTokens, getRefreshToken, saveTokens } from '@/lib/auth/tokenStore';
import type { UserResponse, VerificationScene } from '@/lib/api/types';

type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

type RegisterInput = {
  email: string;
  code: string;
  username: string;
  password: string;
  phone?: string;
};

type AuthStore = {
  status: AuthStatus;
  user: UserResponse | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  sendEmailCode: (email: string, scene: VerificationScene) => Promise<void>;
  sendSmsCode: (phone: string, scene: VerificationScene) => Promise<void>;
  updateProfile: (payload: { preferred_name?: string; avatar_url?: string }) => Promise<boolean>;
  uploadAvatar: (file: { uri: string; name: string; type: string }) => Promise<boolean>;
  updateContact: (payload: { email?: string; code?: string; phone?: string }) => Promise<boolean>;
  changePassword: (payload: { newPassword: string; oldPassword?: string; code?: string }) => Promise<boolean>;
  login: (identifier: string, password: string) => Promise<boolean>;
  loginWithEmailCode: (email: string, code: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: (payload: { password?: string; verification_ticket?: string }) => Promise<boolean>;
  clearError: () => void;
};

let bootstrapped = false;

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: 'checking',
  user: null,
  error: null,
  bootstrap: async () => {
    if (bootstrapped) {
      return;
    }
    bootstrapped = true;
    setUnauthorizedHandler(() => {
      set({ status: 'anonymous', user: null });
      router.replace('/auth/login' as Href);
    });

    try {
      const user = await getMe();
      set({ status: 'authenticated', user, error: null });
    } catch {
      await clearStoredTokens();
      set({ status: 'anonymous', user: null });
    }
  },
  sendEmailCode: async (email, scene) => {
    set({ error: null });
    try {
      await sendEmailCodeRequest({ email: email.trim(), scene });
    } catch (error) {
      set({ error: readErrorMessage(error) });
      throw error;
    }
  },
  sendSmsCode: async (phone, scene) => {
    set({ error: null });
    try {
      await sendSmsCodeRequest({ phone: phone.trim(), scene });
    } catch (error) {
      set({ error: readErrorMessage(error) });
      throw error;
    }
  },
  updateProfile: async (payload) => {
    set({ error: null });
    try {
      const user = await updateMe(payload);
      set({ user, error: null });
      return true;
    } catch (error) {
      set({ error: readErrorMessage(error) });
      return false;
    }
  },
  uploadAvatar: async (file) => {
    set({ error: null });
    try {
      const user = await uploadAvatarRequest(file);
      set({ user, error: null });
      return true;
    } catch (error) {
      set({ error: readErrorMessage(error) });
      return false;
    }
  },
  updateContact: async (payload) => {
    set({ error: null });
    try {
      const nextPayload: {
        email?: string;
        email_verification_ticket?: string;
        phone?: string;
        phone_verification_ticket?: string;
      } = {};
      if (payload.email) {
        const verified = await verifyEmailCode({ email: payload.email.trim(), code: (payload.code ?? '').trim(), scene: 'register' });
        if (!verified.verification_ticket) {
          throw new Error('邮箱验证未返回绑定凭证。');
        }
        nextPayload.email = payload.email.trim();
        nextPayload.email_verification_ticket = verified.verification_ticket;
      }
      if (payload.phone) {
        const verified = await verifySmsCode({ phone: payload.phone.trim(), code: (payload.code ?? '').trim(), scene: 'register' });
        if (!verified.verification_ticket) {
          throw new Error('短信验证未返回绑定凭证。');
        }
        nextPayload.phone = payload.phone.trim();
        nextPayload.phone_verification_ticket = verified.verification_ticket;
      }
      const user = await updateContactRequest(nextPayload);
      set({ user, error: null });
      return true;
    } catch (error) {
      set({ error: readErrorMessage(error) });
      return false;
    }
  },
  changePassword: async (payload) => {
    set({ error: null });
    try {
      const user = get().user;
      if (!user) {
        throw new Error('当前用户不存在。');
      }
      if (payload.oldPassword) {
        await changePasswordRequest({
          old_password: payload.oldPassword,
          new_password: payload.newPassword,
        });
      } else {
        const ticket = user.email
          ? (await verifyEmailCode({ email: user.email, code: (payload.code ?? '').trim(), scene: 'password_change' })).verification_ticket
          : user.phone
            ? (await verifySmsCode({ phone: user.phone, code: (payload.code ?? '').trim(), scene: 'password_change' })).verification_ticket
            : null;
        if (!ticket) {
          throw new Error('验证码未返回修改密码凭证。');
        }
        await changePasswordRequest({
          verification_ticket: ticket,
          new_password: payload.newPassword,
        });
      }
      return true;
    } catch (error) {
      set({ error: readErrorMessage(error) });
      return false;
    }
  },
  login: async (identifier, password) => {
    set({ status: 'checking', error: null });
    try {
      const tokens = await loginWithPassword({ identifier: identifier.trim(), password });
      await saveTokens(tokens);
      const user = await getMe();
      set({ status: 'authenticated', user, error: null });
      return true;
    } catch (error) {
      await clearStoredTokens();
      set({ status: 'anonymous', user: null, error: readErrorMessage(error) });
      return false;
    }
  },
  loginWithEmailCode: async (email, code) => {
    set({ status: 'checking', error: null });
    try {
      const result = await verifyEmailCode({ email: email.trim(), code: code.trim(), scene: 'login' });
      if (!result.token_pair) {
        throw new Error('验证码登录未返回 token。');
      }
      await saveTokens(result.token_pair);
      const user = await getMe();
      set({ status: 'authenticated', user, error: null });
      return true;
    } catch (error) {
      await clearStoredTokens();
      set({ status: 'anonymous', user: null, error: readErrorMessage(error) });
      return false;
    }
  },
  register: async (input) => {
    set({ status: 'checking', error: null });
    try {
      const verified = await verifyEmailCode({
        email: input.email.trim(),
        code: input.code.trim(),
        scene: 'register',
      });
      if (!verified.verification_ticket) {
        throw new Error('邮箱验证未返回注册凭证。');
      }
      const tokens = await registerWithEmail({
        username: input.username.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || undefined,
        password: input.password,
        verification_ticket: verified.verification_ticket,
      });
      await saveTokens(tokens);
      const user = await getMe();
      set({ status: 'authenticated', user, error: null });
      return true;
    } catch (error) {
      await clearStoredTokens();
      set({ status: 'anonymous', user: null, error: readErrorMessage(error) });
      return false;
    }
  },
  logout: async () => {
    const refreshToken = await getRefreshToken();
    try {
      if (refreshToken) {
        await logoutRequest(refreshToken);
      }
    } catch {
      // Local logout should still complete when the server session is already gone.
    }
    await clearStoredTokens();
    set({ status: 'anonymous', user: null, error: null });
    router.replace('/auth/login' as Href);
  },
  deleteAccount: async (payload) => {
    set({ error: null });
    try {
      await deleteAccountRequest(payload);
      await get().logout();
      return true;
    } catch (error) {
      set({ error: readErrorMessage(error) });
      return false;
    }
  },
  clearError: () => set({ error: null }),
}));

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
