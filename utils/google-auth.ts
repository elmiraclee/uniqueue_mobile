/**
 * Google Sign-In for Expo (AuthSession + WebBrowser).
 * Uses the same Google account flow as the web app:
 * 1) User picks a Google account
 * 2) Mobile sends id_token to uniqueue_api/google_auth.php
 * 3) API returns login user OR signup_required + Google profile
 */

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';

import {
  API,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';

WebBrowser.maybeCompleteAuthSession();

export type GoogleProfile = {
  registration_token: string;
  google_id: string;
  email: string;
  first_name: string;
  last_name: string;
  picture: string;
};

export type GoogleAuthResult =
  | { ok: true; action: 'login'; user: any }
  | { ok: true; action: 'signup_required'; google: GoogleProfile }
  | { ok: false; message: string; cancelled?: boolean };

function clientIdsConfigured(): boolean {
  const web = GOOGLE_WEB_CLIENT_ID || '';
  return !!web && !web.startsWith('YOUR_GOOGLE');
}

/**
 * Hook wrapper around expo-auth-session Google provider.
 * Use in login / signup screens.
 */
export function useGoogleAuthRequest() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    // Web client ID is required for id_token on most Expo flows
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID?.startsWith('YOUR_GOOGLE')
      ? undefined
      : GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID?.startsWith('YOUR_GOOGLE')
      ? undefined
      : GOOGLE_IOS_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
  });

  return { request, response, promptAsync, ready: !!request && clientIdsConfigured() };
}

/**
 * Exchange the AuthSession result for a Uniqueue session via our API.
 */
export async function completeGoogleAuth(
  authentication: {
    idToken?: string | null;
    accessToken?: string | null;
  } | null
): Promise<GoogleAuthResult> {
  if (!authentication) {
    return { ok: false, message: 'No Google credentials returned.' };
  }

  const id_token = authentication.idToken ?? undefined;
  const access_token = authentication.accessToken ?? undefined;

  if (!id_token && !access_token) {
    return {
      ok: false,
      message:
        'Google did not return a token. Check that GOOGLE_WEB_CLIENT_ID is set and the OAuth client allows this app.',
    };
  }

  const data = await fetchJsonOrNull(
    API.googleAuth,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_token: id_token || null,
        access_token: access_token || null,
      }),
    },
    'Google Auth Error'
  );

  if (!data) {
    return {
      ok: false,
      message: 'Could not reach the server to finish Google sign-in.',
    };
  }

  if (!data.success) {
    return {
      ok: false,
      message: data.message || 'Google sign-in failed.',
    };
  }

  if (data.action === 'login' && data.user) {
    return { ok: true, action: 'login', user: data.user };
  }

  if (data.action === 'signup_required' && data.google) {
    return { ok: true, action: 'signup_required', google: data.google };
  }

  return { ok: false, message: 'Unexpected response from Google sign-in.' };
}

export { clientIdsConfigured };
