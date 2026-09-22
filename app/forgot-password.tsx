import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AnimatedPressable from '../components/ui/animated-pressable';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export default function ForgotPassword() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [masked, setMasked] = useState('');

  const requestOtp = async () => {
    if (!email.trim()) {
      Alert.alert('Email required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_otp', email: email.trim().toLowerCase() }),
      });
      if (res?.success) {
        setMasked(res.masked || email);
        setStep(2);
        Alert.alert('Check your email', res.message || 'OTP sent if email is registered.');
      } else {
        Alert.alert('Error', res?.message || 'Failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', email: email.trim().toLowerCase(), otp }),
      });
      if (res?.success) setStep(3);
      else Alert.alert('Error', res?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPw = async () => {
    if (password.length < 6) {
      Alert.alert('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          email: email.trim().toLowerCase(),
          otp,
          password,
        }),
      });
      if (res?.success) {
        Alert.alert('Done', 'Password updated. You can sign in now.', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
      } else {
        Alert.alert('Error', res?.message || 'Reset failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.sub}>Student or parent account recovery via email OTP</Text>

        {step === 1 && (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <AnimatedPressable style={styles.btn} onPress={requestOtp} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send OTP'}</Text>
            </AnimatedPressable>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.sub}>Code sent to {masked || email}</Text>
            <Text style={styles.label}>OTP</Text>
            <TextInput style={styles.input} value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
            <AnimatedPressable style={styles.btn} onPress={verifyOtp} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Checking…' : 'Verify OTP'}</Text>
            </AnimatedPressable>
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.label}>New password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
            <Text style={styles.label}>Confirm</Text>
            <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry />
            <AnimatedPressable style={styles.btn} onPress={resetPw} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Saving…' : 'Update password'}</Text>
            </AnimatedPressable>
          </>
        )}

        <AnimatedPressable onPress={() => router.back()} style={{ marginTop: 20, alignItems: 'center' }}>
          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Back to login</Text>
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  sub: { color: COLORS.gray, marginBottom: 16, marginTop: 4 },
  label: { fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
