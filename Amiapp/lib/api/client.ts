import { AMI_ACCESS_TOKEN, buildApiUrl } from './config';

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
};

export function buildAuthHeaders(): Record<string, string> {
  if (!AMI_ACCESS_TOKEN) {
    return {};
  }
  return {
    Authorization: `Bearer ${AMI_ACCESS_TOKEN}`,
    'X-Auth-Token': AMI_ACCESS_TOKEN,
  };
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const hasBody = typeof options.body !== 'undefined';
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...buildAuthHeaders(),
    ...options.headers,
  };
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildApiUrl(path), {
    method: options.method ?? (hasBody ? 'POST' : 'GET'),
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const detail = contentType.includes('application/json') ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message = typeof detail === 'object' && detail && 'detail' in detail ? String(detail.detail) : response.statusText;
    throw new AmiApiError(message, response.status, detail);
  }

  return detail as T;
}
