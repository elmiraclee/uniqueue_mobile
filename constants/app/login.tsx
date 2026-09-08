import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import CustomButton from '../components/ui/custom-button';
import CustomInput from '../components/ui/custom-input';
import { API } from '../constants/backend';
import { COLORS } from '../constants/theme';
import {
  completeGoogleAuth,
  useGoogleAuthRequest,
} from '@/utils/google-auth';

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
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Stay logged in after app refresh / reload unless the user signed out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await AsyncStorage.getItem('user');
        if (!cancelled && user) {
          router.replace('/student/home');
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
            Alert.alert('Google Sign-In', result.message);
            return;
          }
          if (result.action === 'login') {
            await AsyncStorage.setItem('user', JSON.stringify(result.user));
            await AsyncStorage.setItem('role', 'student');
            router.replace('/student/home');
            return;
          }
          // New Google account → finish signup (same as web)
          await AsyncStorage.setItem('google_pending', JSON.stringify(result.google));
          router.push('/signup');
        } catch (e) {
          console.log('Google login error', e);
          Alert.alert('Google Sign-In', 'Something went wrong. Please try again.');
        } finally {
          setGoogleLoading(false);
        }
      })();
    } else if (googleResponse.type === 'error') {
      Alert.alert(
        'Google Sign-In',
        googleResponse.error?.message || 'Sign-in was cancelled or failed.'
      );
    }
  }, [googleResponse]);

  const handleLogin = async () => {
    if (!srCode.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(API.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: srCode,
          password: password,
        }),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert('Server Error', 'Invalid JSON response from server');
        return;
      }

      if (!data.success) {
        Alert.alert('Login Failed', data.message || 'Invalid credentials');
        return;
      }

      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('role', 'student');
      router.replace('/student/home');
    } catch (error) {
      console.log('LOGIN ERROR:', error);
      Alert.alert('Connection Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = async () => {
    if (!googleReady || !googleRequest) {
      Alert.alert(
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
      Alert.alert('Google Sign-In', 'Could not open Google sign-in.');
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
            <Text style={styles.subtitle}>Sign in using your SR-Code</Text>

            <CustomInput
              placeholder="SR-Code"
              value={srCode}
              onChangeText={setSrCode}
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

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              style={[
                styles.googleButton,
                (googleLoading || loading) && styles.googleButtonDisabled,
              ]}
              disabled={googleLoading || loading}
              onPress={handleGooglePress}
            >
              {googleLoading ? (
                <ActivityIndicator color="#1f1f1f" />
              ) : (
                <>
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
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
    marginVertical: 16,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(102,8,16,0.12)',
  },
  orText: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleButtonDisabled: {
    opacity: 0.55,
  },
  googleG: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f1f1f',
  },
});
