import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

import AppHeader from '../../components/layout/app-header';
import AnimatedPressable from '../../components/ui/animated-pressable';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

const LEVELS = ['Elementary', 'JHS', 'SHS', 'College'];
const RELATIONS = ['Parent/Guardian', 'Mother', 'Father', 'Guardian'];

export default function AddChildScreen() {
  const [srCode, setSrCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [schoolLevel, setSchoolLevel] = useState('College');
  const [gradeYear, setGradeYear] = useState('');
  const [relationship, setRelationship] = useState('Parent/Guardian');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'link' | 'create'>('link');

  const submit = async () => {
    if (!/^\d{2}-\d{5}$/.test(srCode.trim())) {
      Alert.alert('Invalid SR Code', 'Use format YY-NNNNN (e.g. 26-12345)');
      return;
    }
    if (mode === 'create' && (!firstName.trim() || !lastName.trim())) {
      Alert.alert('Required', 'First and last name are required to create a profile');
      return;
    }

    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : null;
      if (!user?.id) {
        Alert.alert('Error', 'Not logged in');
        return;
      }

      const body: any = {
        parent_id: user.id,
        sr_code: srCode.trim(),
        relationship,
        mode,
      };
      if (mode === 'create') {
        body.first_name = firstName.trim();
        body.last_name = lastName.trim();
        body.school_level = schoolLevel;
        body.grade_year = gradeYear;
      }

      const res = await fetchJsonOrNull(API.parentAddChild, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res?.success) {
        const msg = res.mode === 'request'
          ? (res.message || 'Link request sent. Waiting for student to accept.')
          : (res.message || 'Child linked. You can see them on the Children tab.');
        Alert.alert('Success', msg, [
          { text: 'OK', onPress: () => router.replace('/parent/home') },
        ]);
      } else {
        Alert.alert('Failed', res?.message || 'Could not add child');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Add / Link Child" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.hint}>
          Enter the student's SR Code. If they already have an account, a link
          request will be sent for approval. You can also create a parent-managed
          profile for younger students.
        </Text>

        <View style={styles.modeRow}>
          <AnimatedPressable
            style={[styles.modeBtn, mode === 'link' && styles.modeActive]}
            onPress={() => setMode('link')}
          >
            <Text style={[styles.modeText, mode === 'link' && styles.modeTextActive]}>
              Link existing
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.modeBtn, mode === 'create' && styles.modeActive]}
            onPress={() => setMode('create')}
          >
            <Text style={[styles.modeText, mode === 'create' && styles.modeTextActive]}>
              Create profile
            </Text>
          </AnimatedPressable>
        </View>

        <Text style={styles.label}>SR Code *</Text>
        <TextInput
          style={styles.input}
          value={srCode}
          onChangeText={setSrCode}
          placeholder="26-12345"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        {mode === 'create' && (
          <>
            <Text style={styles.label}>First name *</Text>
            <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />
            <Text style={styles.label}>Last name *</Text>
            <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
            <Text style={styles.label}>School level *</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={schoolLevel} onValueChange={setSchoolLevel}>
                {LEVELS.map((l) => (
                  <Picker.Item key={l} label={l} value={l} />
                ))}
              </Picker>
            </View>
            <Text style={styles.label}>Grade / Year</Text>
            <TextInput
              style={styles.input}
              value={gradeYear}
              onChangeText={setGradeYear}
              placeholder="e.g. Grade 10 / 3rd Year"
            />
          </>
        )}

        <Text style={styles.label}>Relationship</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={relationship} onValueChange={setRelationship}>
            {RELATIONS.map((r) => (
              <Picker.Item key={r} label={r} value={r} />
            ))}
          </Picker>
        </View>

        <AnimatedPressable
          style={[styles.submit, loading && { opacity: 0.6 }]}
          onPress={submit}
          disabled={loading}
        >
          <Text style={styles.submitText}>
            {loading ? 'Saving…' : mode === 'link' ? 'Send link request' : 'Create & link'}
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  hint: { color: COLORS.gray, marginBottom: SPACING.lg, lineHeight: 20 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.lg },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  modeActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  modeText: { fontWeight: '600', color: COLORS.gray },
  modeTextActive: { color: COLORS.primary },
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
  pickerWrap: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  submit: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
