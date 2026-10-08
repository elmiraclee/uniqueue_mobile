/**
 * Activate a parent-created student profile — mobile version of
 * web auth/activate-student.php (same validation + rules).
 */
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { API } from '@/constants/backend';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { fetchJsonOrNull } from '@/utils/api';
import { passwordError } from '@/utils/password';
import { registerPushToken } from '@/components/notification/push';
import PasswordChecklist from '@/components/ui/password-checklist';

type Level = 'JHS' | 'SHS' | 'College';
const GRADES: Record<Level, string[]> = {
  JHS: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
  SHS: ['Grade 11', 'Grade 12'],
  College: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'],
};
const NAME_RE = /^[a-zA-ZñÑ' -]{1,50}$/;

export default function ActivateAccount() {
  const [srCode, setSrCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<Level>('JHS');
  const [grade, setGrade] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^\d{2}-\d{5}$/.test(srCode.trim())) return Alert.alert('SR Code', 'SR Code must use the format YY-NNNNN.');
    if (!NAME_RE.test(firstName.trim()) || !NAME_RE.test(lastName.trim()))
      return Alert.alert('Name', 'Enter the name exactly as it appears on the existing student profile.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert('Email', 'Enter a valid email address.');
    const pwErr = passwordError(password);
    if (pwErr) return Alert.alert('Password', pwErr);
    if (password !== confirm) return Alert.alert('Password', 'Passwords do not match.');

    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.activateStudent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sr_code: srCode.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          school_level: level,
          grade_year: grade,
          password,
          confirm_password: confirm,
        }),
      });
      if (!res?.success) {
        Alert.alert('Activation failed', res?.message || 'Unable to activate this account.');
        return;
      }
      await AsyncStorage.setItem('user', JSON.stringify(res.user));
      await AsyncStorage.setItem('role', 'student');
      const id = Number(res.user?.id ?? 0);
      if (id) await registerPushToken({ role: 'student', id });
      Alert.alert('Account activated', res.message || 'Your student account is now active.', [
        { text: 'OK', onPress: () => router.replace('/student/home') },
      ]);
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Activate Student Account</Text>
        <Text style={styles.sub}>
          Your parent/guardian already created a UniQueue profile for you. Confirm your details and set a password to
          start using your own account.
        </Text>

        <Text style={styles.label}>SR Code *</Text>
        <TextInput style={styles.input} value={srCode} onChangeText={setSrCode} placeholder="YY-NNNNN" autoCapitalize="none" />

        <Text style={styles.label}>First name *</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
        <Text style={styles.label}>Last name *</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

        <Text style={styles.label}>Email *</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>School level *</Text>
        <View style={styles.row}>
          {(['JHS', 'SHS', 'College'] as Level[]).map((l) => (
            <Chip key={l} label={l} active={level === l} onPress={() => { setLevel(l); setGrade(''); }} />
          ))}
        </View>

        <Text style={styles.label}>Grade / Year</Text>
        <View style={styles.row}>
          {GRADES[level].map((g) => (
            <Chip key={g} label={g} active={grade === g} onPress={() => setGrade(grade === g ? '' : g)} />
          ))}
        </View>

        <Text style={styles.label}>Password *</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
        <Text style={styles.label}>Confirm password *</Text>
        <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry />
        <PasswordChecklist password={password} confirm={confirm} />

        <Pressable style={[styles.btn, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Activating…' : 'Activate account'}</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>Back to login</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  sub: { color: COLORS.gray, marginBottom: 20, marginTop: 4, lineHeight: 20 },
  label: { fontWeight: '600', marginBottom: 6, color: COLORS.text },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.md, fontSize: 16,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.primary, fontWeight: '600' },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
