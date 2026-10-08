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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import AnimatedPressable from '../components/ui/animated-pressable';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { registerPushToken } from '@/components/notification/push';
import PasswordChecklist from '@/components/ui/password-checklist';
import { passwordError } from '@/utils/password';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export default function ParentSignup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || !contact.trim() || !password) {
      Alert.alert('Required', 'Full name, email, contact number and password are required');
      return;
    }
    const pwErr = passwordError(password);
    if (pwErr) {
      Alert.alert('Password', pwErr);
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password', 'Passwords do not match');
      return;
    }
    if (!consent) {
      Alert.alert('Terms', 'You must agree to the Terms of Use and Privacy Notice.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.parentSignup, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          contact_number: contact.trim(),
          password,
          confirm_password: confirm,
          consent_privacy: consent ? 1 : 0,
        }),
      });
      if (res?.success) {
        await AsyncStorage.setItem('user', JSON.stringify(res.user));
        await AsyncStorage.setItem('role', 'parent');
        const id = Number(res.user?.id ?? res.user?.parent_id ?? 0);
        if (id) await registerPushToken({ role: 'parent', id });
        Alert.alert('Welcome', 'Account created', [
          { text: 'OK', onPress: () => router.replace('/parent/home') },
        ]);
      } else {
        Alert.alert('Failed', res?.message || 'Could not register');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Parent / Guardian Sign up</Text>
        <Text style={styles.sub}>Create an account to manage your children's queues</Text>

        <Text style={styles.label}>Full name *</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Contact number *</Text>
        <TextInput
          style={styles.input}
          value={contact}
          onChangeText={setContact}
          keyboardType="phone-pad"
          placeholder="09XXXXXXXXX or +639XXXXXXXXX"
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={styles.label}>Confirm password *</Text>
        <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry />
        <PasswordChecklist password={password} confirm={confirm} />

        <AnimatedPressable style={styles.consentRow} onPress={() => setConsent((v) => !v)}>
          <View style={[styles.checkbox, consent && styles.checkboxOn]}>
            {consent && <Text style={{ color: '#fff', fontWeight: '800' }}>✓</Text>}
          </View>
          <Text style={styles.consentText}>
            I agree to the UniQueue Terms of Use and Privacy Notice, and consent to the processing of my and my
            child's personal data for queue management.
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          style={[styles.btn, loading && { opacity: 0.6 }]}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Creating…' : 'Create account'}</Text>
        </AnimatedPressable>

        <AnimatedPressable onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Already have an account? Sign in</Text>
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  sub: { color: COLORS.gray, marginBottom: 20, marginTop: 4 },
  label: { fontWeight: '600', marginBottom: 6, color: COLORS.text },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.md,
    fontSize: 16,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  checkboxOn: { backgroundColor: COLORS.primary },
  consentText: { flex: 1, color: COLORS.text, fontSize: 13, lineHeight: 18 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
