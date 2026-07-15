import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { API } from '@/constants/backend';
import AppHeader from '../../components/layout/app-header';
import { COLORS } from '../../constants/theme';

type FieldKey = 'full_name' | 'college_name' | 'program' | 'year_level';

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default function Profile() {
  const router = useRouter();

  const [student, setStudent] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    college_name: '',
    program: '',
    year_level: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsed = JSON.parse(user);
      const response = await fetch(`${API.getStudentProfile}?student_id=${parsed.id}`);
      const data = await response.json();

      if (data.success && data.student) {
        const profile = data.student;
        setStudent(profile);
        setForm({
          full_name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
          college_name: profile.college_name ?? '',
          program: profile.program_name ?? '',
          year_level: profile.year_level ?? '',
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const updateField = (key: FieldKey, text: string) => {
    setForm(prev => ({ ...prev, [key]: text }));
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('role');
          router.replace('/login');
        },
      },
    ]);
  };

  const saveProfile = async () => {
    const updatedStudent = {
      ...student,
      full_name: form.full_name,
      college_name: form.college_name,
      program_name: form.program,
      year_level: form.year_level,
    };

    await AsyncStorage.setItem('user', JSON.stringify(updatedStudent));
    setStudent(updatedStudent);
    setEditing(false);

    Alert.alert('Success', 'Profile updated.');
  };

  const cancelEditing = () => {
    if (student) {
      setForm({
        full_name: `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim(),
        college_name: student.college_name ?? '',
        program: student.program_name ?? '',
        year_level: student.year_level ?? '',
      });
    }
    setEditing(false);
  };

  const renderField = (label: string, key: FieldKey, isLast?: boolean) => (
    <View style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
      <Text style={styles.label}>{label}</Text>
      {editing ? (
        <TextInput
          style={styles.input}
          value={form[key]}
          onChangeText={(text) => updateField(key, text)}
          placeholder={`Enter ${label.toLowerCase()}`}
          placeholderTextColor="#B7A79E"
        />
      ) : (
        <Text style={styles.value}>{form[key] || '—'}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Identity card */}
        <View style={styles.card}>
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitials(form.full_name || 'Student')}
              </Text>
            </View>

            <View style={styles.identityInfo}>
              <Text style={styles.identityName} numberOfLines={1}>
                {form.full_name || 'Student'}
              </Text>
              <View style={styles.srCodeChip}>
                <Text style={styles.srCodeText}>
                  {student?.sr_code ?? 'No SR-Code'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Details card */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Personal Details</Text>
          {renderField('Full Name', 'full_name')}
          <View style={styles.fieldRow}>
            <Text style={styles.label}>SR-Code</Text>
            <Text style={styles.value}>{student?.sr_code ?? '—'}</Text>
          </View>

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
            Academic Details
          </Text>
          {renderField('College Name', 'college_name')}
          {renderField('Program', 'program')}
          {renderField('Year Level', 'year_level', true)}
        </View>

        {/* Actions */}
        {editing ? (
          <View style={styles.editRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveProfile} activeOpacity={0.85}>
              <Text style={styles.saveText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)} activeOpacity={0.85}>
            <Text style={styles.editText}>Edit Profile</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // ----- Page header -----
  pageHeader: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
  },

  // ----- Cards -----
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECE3DE',
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sectionLabelSpaced: {
    marginTop: 18,
  },

  // ----- Identity header -----
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  identityInfo: {
    flex: 1,
  },
  identityName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  srCodeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.accent + '55',
  },
  srCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  // ----- Fields -----
  fieldRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EAE6',
  },
  fieldRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  label: {
    color: COLORS.gray,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  value: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#FAF6F4',
  },

  // ----- Buttons -----
  editButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  editText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  editRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  cancelText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  logoutButton: {
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  logoutText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});