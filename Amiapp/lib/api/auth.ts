import { apiRequest } from './client';
import { buildAuthHeaders } from './client';
import { buildApiUrl } from './config';
import type { EmailVerificationResponse, SmsVerificationResponse, TokenPair, UserResponse, VerificationScene } from './types';

export function sendEmailCode(payload: { email: string; scene: VerificationScene }) {
  return apiRequest<void>('/auth/email/send', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function verifyEmailCode(payload: { email: string; code: string; scene: VerificationScene }) {
  return apiRequest<EmailVerificationResponse>('/auth/email/verify', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function sendSmsCode(payload: { phone: string; scene: VerificationScene }) {
  return apiRequest<void>('/auth/sms/send', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function verifySmsCode(payload: { phone: string; code: string; scene: VerificationScene }) {
  return apiRequest<SmsVerificationResponse>('/auth/sms/verify', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function registerWithEmail(payload: {
  username: string;
  email: string;
  phone?: string;
  password: string;
  verification_ticket: string;
}) {
  return apiRequest<TokenPair>('/auth/register', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function loginWithPassword(payload: { identifier: string; password: string }) {
  return apiRequest<TokenPair>('/auth/login', {
    method: 'POST',
    body: payload,
    auth: false,
  });
}

export function getMe() {
  return apiRequest<UserResponse>('/auth/me');
}

export function updateMe(payload: { preferred_name?: string; avatar_url?: string }) {
  return apiRequest<UserResponse>('/auth/me', {
    method: 'PATCH',
    body: payload,
  });
}

export async function uploadAvatar(file: { uri: string; name: string; type: string }) {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  const response = await fetch(buildApiUrl('/auth/me/avatar'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(await buildAuthHeaders()),
    },
    body: formData,
  });
  const detail = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof detail === 'object' && detail && 'detail' in detail && detail.detail
        ? String(detail.detail)
        : typeof detail === 'object' && detail && 'message' in detail && detail.message
          ? String(detail.message)
          : response.statusText;
    throw new Error(message);
  }
  return detail as UserResponse;
}

export function changePassword(payload: { new_password: string; old_password?: string; verification_ticket?: string }) {
  return apiRequest<void>('/auth/password', {
    method: 'PATCH',
    body: payload,
  });
}

export function updateContact(payload: {
  email?: string;
  email_verification_ticket?: string;
  phone?: string;
  phone_verification_ticket?: string;
}) {
  return apiRequest<UserResponse>('/auth/me/contact', {
    method: 'PATCH',
    body: payload,
  });
}

export function logout(refreshToken: string) {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { refresh_token: refreshToken },
  });
}

export function deleteAccount(payload: { password?: string; verification_ticket?: string }) {
  return apiRequest<void>('/auth/account/delete', {
    method: 'POST',
    body: payload,
  });
}
