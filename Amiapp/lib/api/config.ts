const env = process.env as Record<string, string | undefined>;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const AMI_API_BASE_URL = trimTrailingSlash(env.EXPO_PUBLIC_AMI_API_BASE_URL ?? 'http://localhost:8000');
export const AMI_DEFAULT_SPACE_ID = env.EXPO_PUBLIC_AMI_SPACE_ID?.trim() ?? '';

export function isBackendChatConfigured() {
  return Boolean(AMI_API_BASE_URL && AMI_DEFAULT_SPACE_ID);
}

export function isBackendApiConfigured() {
  return Boolean(AMI_API_BASE_URL);
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${AMI_API_BASE_URL}${normalizedPath}`;
}
