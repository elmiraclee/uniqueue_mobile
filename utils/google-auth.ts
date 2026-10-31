import { router } from 'expo-router';
/**
 * Google Sign-In for Expo (AuthSession + WebBrowser).
 * Uses the same Google account flow as the web app:
 * 1) User picks a Google account
 * 2) Mobile sends id_token to uniqueue_api/google_auth.php
 * 3) API returns login user OR signup_required + Google profile
 */

import type * as GoogleProvider from 'expo-auth-session/providers/google';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import {
  API,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';


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
  const id = Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : Platform.OS === 'android' ? GOOGLE_ANDROID_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;
  return !!id && !id.startsWith('YOUR_GOOGLE');
}

type GoogleRequestTuple = ReturnType<typeof GoogleProvider.useAuthRequest>;
type GoogleRequestConfig = Parameters<typeof GoogleProvider.useAuthRequest>[0];

/**
 * A stale development binary may lack a native module even though Metro can
 * bundle its JS. Do not evaluate Google's eager ExpoApplication import then:
 * Login/Signup must still load for email/password authentication.
 * Runtime availability is fixed for this JS runtime; rebuilding/reloading is
 * required to change it. Never switch between hook implementations on render.
 */
function loadGoogleRuntime(): { useRequest: typeof GoogleProvider.useAuthRequest | null; reason: string } {
  if (!clientIdsConfigured()) {
    return { useRequest: null, reason: `Google sign-in is not configured for ${Platform.OS}. Set the matching EXPO_PUBLIC_GOOGLE_${Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB'}_CLIENT_ID before building.` };
  }
  if (Platform.OS !== 'web') {
    const required = ['ExpoApplication', 'ExpoCrypto', 'ExpoWebBrowser'];
    const missing = required.filter(name => !requireOptionalNativeModule(name));
    if (missing.length) return {
      useRequest: null,
      reason: `This installed app is missing native modules: ${missing.join(', ')}. Rebuild and reinstall the development/production app, then reconnect Metro. A refresh cannot add native modules. Email/password login is still available.`,
    };
  }
  try {
    // Metro requires literal paths. These imports are deliberately guarded;
    // static value imports would crash route evaluation before the guard runs.
    const google = require('expo-auth-session/providers/google') as typeof GoogleProvider;
    const browser = require('expo-web-browser') as typeof import('expo-web-browser');
    browser.maybeCompleteAuthSession();
    return { useRequest: google.useAuthRequest, reason: '' };
  } catch {
    return { useRequest: null, reason: 'Google sign-in could not initialize in this installed app. Install matching native dependencies, rebuild/reinstall the app and reconnect Metro. Email/password login is still available.' };
  }
}

const googleRuntime = loadGoogleRuntime();
function useUnavailableGoogleRequest(_config?: GoogleRequestConfig): GoogleRequestTuple {
  return [null, null, async () => { throw new Error(googleRuntime.reason); }];
}
// Selected once at module initialization, not conditionally during a render.
const useRuntimeGoogleRequest = googleRuntime.useRequest ?? useUnavailableGoogleRequest;

/** Google is optional at route startup; password login must remain usable. */
export function useGoogleAuthRequest() {
  const [request, response, promptAsync] = useRuntimeGoogleRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: ['openid', 'profile', 'email'],
  });
  return {
    request, response, promptAsync,
    ready: !!request && !!googleRuntime.useRequest && clientIdsConfigured(),
    unavailableReason: googleRuntime.reason || 'Google sign-in is still preparing. Please try again shortly.',
  };
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
    if(data.next_action==='activate')router.push('/activate-account');
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
