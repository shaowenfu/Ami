import { create } from 'zustand';
import { router } from 'expo-router';
import type { Href } from 'expo-router';

import {
  deleteAccount as deleteAccountRequest,
  getMe,
  loginWithPassword,
  logout as logoutRequest,
  registerWithEmail,
  sendEmailCode as sendEmailCodeRequest,
  setUnauthorizedHandler,
  verifyEmailCode,
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
