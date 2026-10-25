import { clientAlert } from '@/components/client/client-ui';
import { clientFetch } from '@/utils/client-fetch';
import { getSessionToken } from '@/utils/session-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import CustomButton from '../components/ui/custom-button';
import GoogleLogo from '../components/ui/google-logo';
import CustomInput from '../components/ui/custom-input';
import { API } from '../constants/backend';
import { COLORS } from '../constants/theme';
import {
  completeGoogleAuth,
  useGoogleAuthRequest,
} from '@/utils/google-auth';
import { registerPushToken } from '@/components/notification/push';

export default function Login() {
  const router = useRouter();
  const {
    request: googleRequest,
    response: googleResponse,
    promptAsync: promptGoogle,
    ready: googleReady,
  } = useGoogleAuthRequest();

  const [srCode, setSrCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [password, setPassword] = useState('');
  const [loginRole, setLoginRole] = useState<'student' | 'parent'>('student');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Stay logged in after app refresh / reload unless the user signed out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await AsyncStorage.getItem('user');
        const role = await AsyncStorage.getItem('role');
        const token = await getSessionToken();
        // Match the protected layouts: cached user data alone is not a session.
        if (!cancelled && user && token) {
          router.replace(role === 'parent' ? '/parent/home' : '/student/home');
          return;
        }
      } catch {
        // ignore — show login form
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Complete Google flow when AuthSession returns
  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === 'success') {
      (async () => {
        setGoogleLoading(true);
        try {
          const result = await completeGoogleAuth(googleResponse.authentication);
          if (!result.ok) {
            clientAlert('Google Sign-In', result.message);
            return;
          }
          if (result.action === 'login') {
            await AsyncStorage.setItem('user', JSON.stringify(result.user));
            await AsyncStorage.setItem('role', 'student');
            const id = Number(result.user?.id ?? result.user?.student_id ?? 0);
            if (id) await registerPushToken({ role: 'student', id });
            router.replace('/student/home');
            return;
          }
          // New Google account → finish signup (same as web)
          await AsyncStorage.setItem('google_pending', JSON.stringify(result.google));
          router.push('/signup');
        } catch (e) {
          console.log('Google login error', e);
          clientAlert('Google Sign-In', 'Something went wrong. Please try again.');
        } finally {
          setGoogleLoading(false);
        }
      })();
    } else if (googleResponse.type === 'error') {
      clientAlert(
        'Google Sign-In',
        googleResponse.error?.message || 'Sign-in was cancelled or failed.'
      );
    }
  }, [googleResponse]);

  const handleLogin = async () => {
    if (!srCode.trim() || !password.trim()) {
      clientAlert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      setLoading(true);

      const endpoint = loginRole === 'parent' ? API.parentLogin : API.login;
      const body =
        loginRole === 'parent'
          ? { email: srCode.trim(), password }
          : { username: srCode.trim(), password };

      const response = await clientFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        clientAlert('Server Error', 'Invalid JSON response from server');
        return;
      }

      if (!data.success) {
        clientAlert('Login Failed', data.message || 'Invalid credentials');
        return;
      }

      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      const signedInRole = data.role === 'parent' ? 'parent' : loginRole;
      await AsyncStorage.setItem('role', signedInRole);
      const ownerId = Number(
        data.user?.id ??
          data.user?.student_id ??
          data.user?.parent_id ??
          0,
      );
      if (ownerId) {
        await registerPushToken({ role: signedInRole, id: ownerId });
      }
      router.replace(loginRole === 'parent' ? '/parent/home' : '/student/home');
    } catch (error) {
      console.log('LOGIN ERROR:', error);
      clientAlert('Connection Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = async () => {
    if (!googleReady || !googleRequest) {
      clientAlert(
        'Google Sign-In',
        'Set GOOGLE_WEB_CLIENT_ID in constants/backend.ts (Google Cloud Console → Web client ID), then restart Expo.'
      );
      return;
    }
    try {
      setGoogleLoading(true);
      await promptGoogle();
    } catch (e) {
      console.log(e);
      clientAlert('Google Sign-In', 'Could not open Google sign-in.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  if (checkingSession) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#660810']}
              tintColor="#660810"
            />
          }
        >
          <View style={styles.card}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logo}
            />

            <Text style={styles.title}>UniQueue</Text>
            <Text style={styles.subtitle}>
              {loginRole === 'parent'
                ? 'Sign in as Parent / Guardian'
                : 'Sign in using your SR-Code'}
            </Text>

            <View style={styles.roleRow}>
              <Pressable
                style={[styles.roleChip, loginRole === 'student' && styles.roleChipActive]}
                onPress={() => setLoginRole('student')}
              >
                <Text style={[styles.roleChipText, loginRole === 'student' && styles.roleChipTextActive]}>
                  Student
                </Text>
              </Pressable>
              <Pressable
                style={[styles.roleChip, loginRole === 'parent' && styles.roleChipActive]}
                onPress={() => setLoginRole('parent')}
              >
                <Text style={[styles.roleChipText, loginRole === 'parent' && styles.roleChipTextActive]}>
                  Parent
                </Text>
              </Pressable>
            </View>

            <CustomInput
              placeholder={loginRole === 'parent' ? 'Email or contact number' : 'SR-Code'}
              value={srCode}
              onChangeText={setSrCode}
              autoCapitalize="none"
              keyboardType={loginRole === 'parent' ? 'email-address' : 'default'}
            />

            <CustomInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <CustomButton
              title={loading ? 'Logging in...' : 'Login'}
              onPress={handleLogin}
            />

            <Pressable onPress={() => router.push('/forgot-password')} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Forgot password?</Text>
            </Pressable>

            {loginRole === 'student' && (
              <Pressable onPress={() => router.push('/activate-account')} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: COLORS.primary, fontWeight: '600' }}>
                  Parent made your profile? Activate your account
                </Text>
              </Pressable>
            )}

            {loginRole === 'parent' && (
              <Pressable onPress={() => router.push('/parent-signup')} style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Create parent account</Text>
              </Pressable>
            )}

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
                (googleLoading || loading) && styles.googleButtonDisabled,
              ]}
              disabled={googleLoading || loading}
              onPress={handleGooglePress}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
            >
              {googleLoading ? (
                <ActivityIndicator color="#1f1f1f" />
              ) : (
                <View style={styles.googleButtonInner}>
                  <GoogleLogo size={20} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              )}
            </Pressable>

            <Pressable onPress={() => router.push('/signup')}>
              <Text style={styles.linkText}>
                Don't have an account?{' '}
                <Text style={styles.linkTextStrong}>Sign Up</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 15,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  roleChipActive: {
    borderColor: '#660810',
    backgroundColor: 'rgba(102,8,16,0.08)',
  },
  roleChipText: {
    fontWeight: '600',
    color: '#6b7280',
  },
  roleChipTextActive: {
    color: '#660810',
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 25,
    borderRadius: 20,
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
    elevation: 4,
  },
  logo: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 35,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: COLORS.gray,
    marginBottom: 30,
    marginTop: 10,
  },
  linkText: {
    textAlign: 'center',
    marginTop: 20,
    color: COLORS.gray,
    fontSize: 15,
  },
  linkTextStrong: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60,64,67,0.25)',
  },
  orText: {
    color: '#5f6368',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    // soft shadow — matches Material / Google button feel
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  googleButtonPressed: {
    backgroundColor: '#f8f9fa',
    borderColor: '#c6c9ce',
  },
  googleButtonDisabled: {
    opacity: 0.55,
  },
  googleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3c4043',
    letterSpacing: 0.15,
  },
});
