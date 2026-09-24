import { useEffect, useState } from 'react';
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

/*
|--------------------------------------------------------------------------
| Web parity — parent/add-child.php
|--------------------------------------------------------------------------
| One form, no "link vs create" toggle. The child's name, SR Code, school
| level and grade / year level are always required, and the school level
| decides what happens:
|
|   Elementary          -> parent-managed profile, linked right away
|   JHS / SHS / College -> the student must already have a UniQueue
|                          account and must approve the link request
*/
const LEVELS: { label: string; value: SchoolLevel }[] = [
  { label: 'Elementary', value: 'Elementary' },
  { label: 'Junior High School (JHS)', value: 'JHS' },
  { label: 'Senior High School (SHS)', value: 'SHS' },
  { label: 'College', value: 'College' },
];
const RELATIONS = ['Parent/Guardian', 'Mother', 'Father', 'Guardian'];

type SchoolLevel = 'Elementary' | 'JHS' | 'SHS' | 'College';

const GRADE_OPTIONS: Record<SchoolLevel, string[]> = {
  Elementary: [
    'Kindergarten',
    'Grade 1',
    'Grade 2',
    'Grade 3',
    'Grade 4',
    'Grade 5',
    'Grade 6',
  ],
  JHS: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
  SHS: ['Grade 11', 'Grade 12'],
  College: [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
    '5th Year',
    '6th Year',
    'Irregular',
  ],
};

const NAME_PATTERN = /^[A-Za-zÑñ' -]{1,50}$/;

export default function AddChildScreen() {
  const [srCode, setSrCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('College');
  const [gradeYear, setGradeYear] = useState('');
  const [relationship, setRelationship] = useState('Parent/Guardian');
  const [loading, setLoading] = useState(false);

  // Elementary children are parent-managed; everyone else needs approval.
  const isElementary = schoolLevel === 'Elementary';

  useEffect(() => {
    setGradeYear('');
  }, [schoolLevel]);

  const submit = async () => {
    if (!/^\d{2}-\d{5}$/.test(srCode.trim())) {
      Alert.alert('Invalid SR Code', 'Use format YY-NNNNN (e.g. 26-12345)');
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required', "Enter the child's first and last name.");
      return;
    }
    if (
      !NAME_PATTERN.test(firstName.trim()) ||
      !NAME_PATTERN.test(lastName.trim())
    ) {
      Alert.alert(
        'Invalid name',
        'Names may only contain letters, spaces, apostrophes, and hyphens.'
      );
      return;
    }
    if (!gradeYear) {
      Alert.alert('Required', "Select the child's grade / year level.");
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

      // The server decides between an immediate link and an approval
      // request from the school level — same rule as the web form.
      const body: any = {
        parent_id: user.id,
        sr_code: srCode.trim(),
        relationship,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        school_level: schoolLevel,
        grade_year: gradeYear,
      };

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
          Add a child from Elementary through College. Elementary profiles are
          parent-managed; JHS, SHS, and College links require the student&apos;s
          approval. Use the name exactly as shown on the student&apos;s school
          record.
        </Text>

        <Text style={styles.label}>SR Code *</Text>
        <TextInput
          style={styles.input}
          value={srCode}
          onChangeText={setSrCode}
          placeholder="26-12345"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>First name *</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

        <Text style={styles.label}>Last name *</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

        <Text style={styles.label}>School level *</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={schoolLevel}
            onValueChange={(value) => setSchoolLevel(value as SchoolLevel)}
          >
            {LEVELS.map((l) => (
              <Picker.Item key={l.value} label={l.label} value={l.value} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Grade / Year Level *</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={gradeYear} onValueChange={setGradeYear}>
            <Picker.Item label="Select grade / year level" value="" />
            {GRADE_OPTIONS[schoolLevel].map((g) => (
              <Picker.Item key={g} label={g} value={g} />
            ))}
          </Picker>
        </View>

        <Text style={styles.note}>
          {isElementary
            ? 'This child will be added as a parent-managed profile and linked to your account right away.'
            : 'The student must already have a UniQueue account. They will get a link request to approve.'}
        </Text>

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
            {loading
              ? 'Saving…'
              : isElementary
                ? 'Add Child'
                : 'Send link request'}
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
  label: { fontWeight: '600', marginBottom: 6, color: COLORS.text },
  note: {
    color: COLORS.gray,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
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
