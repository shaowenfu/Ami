import { clearStoredTokens, getAccessToken, getRefreshToken, saveTokens } from '@/lib/auth/tokenStore';
import { buildApiUrl } from './config';
import type { TokenPair } from './types';

export class AmiApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = 'AmiApiError';
    this.status = status;
    this.detail = detail;
  }
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  auth?: boolean;
  skipRefresh?: boolean;
};

let refreshPromise: Promise<TokenPair | null> | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export async function buildAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  if (!token) {
    return {};
  }
  return {
    Authorization: `Bearer ${token}`,
    'X-Auth-Token': token,
  };
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await sendRequest(path, options);
  if (response.status === 401 && options.auth !== false && !options.skipRefresh) {
    const refreshed = await refreshTokensOnce();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, skipRefresh: true });
    }
    unauthorizedHandler?.();
  }

  const detail = await readResponseDetail(response);

  if (!response.ok) {
    const message =
      typeof detail === 'object' && detail && 'detail' in detail && detail.detail
        ? String(detail.detail)
        : typeof detail === 'object' && detail && 'message' in detail && detail.message
          ? String(detail.message)
          : response.statusText;
    throw new AmiApiError(message, response.status, detail);
  }

  return detail as T;
}

export async function refreshStoredTokens() {
  return refreshTokensOnce();
}

async function sendRequest(path: string, options: ApiRequestOptions) {
  const hasBody = typeof options.body !== 'undefined';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.auth === false ? {} : await buildAuthHeaders()),
    ...options.headers,
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(buildApiUrl(path), {
    method: options.method ?? (hasBody ? 'POST' : 'GET'),
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
}

async function readResponseDetail(response: Response) {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return response.text();
}

async function refreshTokensOnce() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = refreshTokens()
    .catch(async () => {
      await clearStoredTokens();
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

async function refreshTokens() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearStoredTokens();
    return null;
  }

  const response = await fetch(buildApiUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    await clearStoredTokens();
    return null;
  }

  const tokens = (await response.json()) as TokenPair;
  await saveTokens(tokens);
  return tokens;
}
