import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { TokenPair } from '@/lib/api/types';

const ACCESS_TOKEN_KEY = 'ami.accessToken';
const REFRESH_TOKEN_KEY = 'ami.refreshToken';
const ACCESS_EXPIRES_KEY = 'ami.accessTokenExpiresAt';
const REFRESH_EXPIRES_KEY = 'ami.refreshTokenExpiresAt';

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

export async function saveTokens(tokens: TokenPair) {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, tokens.access_token),
    setItem(REFRESH_TOKEN_KEY, tokens.refresh_token),
    setItem(ACCESS_EXPIRES_KEY, tokens.access_token_expires_at),
    setItem(REFRESH_EXPIRES_KEY, tokens.refresh_token_expires_at),
  ]);
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
    getItem(ACCESS_EXPIRES_KEY),
    getItem(REFRESH_EXPIRES_KEY),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt ?? '',
    refreshTokenExpiresAt: refreshTokenExpiresAt ?? '',
  };
}

export async function getAccessToken() {
  return getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken() {
  return getItem(REFRESH_TOKEN_KEY);
}

export async function clearStoredTokens() {
  await Promise.all([
    deleteItem(ACCESS_TOKEN_KEY),
    deleteItem(REFRESH_TOKEN_KEY),
    deleteItem(ACCESS_EXPIRES_KEY),
    deleteItem(REFRESH_EXPIRES_KEY),
  ]);
}

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
