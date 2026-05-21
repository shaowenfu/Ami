import { apiRequest } from './client';
import type { EmailVerificationResponse, TokenPair, UserResponse, VerificationScene } from './types';

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
