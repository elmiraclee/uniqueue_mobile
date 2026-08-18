import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { API, API_URL } from '@/constants/backend';
import AppHeader from '../../components/layout/app-header';
import {
  COLORS,
  OPACITY,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY
} from '../../constants/theme';

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
  const [picture, setPicture] = useState('');
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
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
        setPicture(profile.picture ?? '');
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

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    uploadPicture(result.assets[0].uri);
  };

  const uploadPicture = async (uri: string) => {
    try {
      setUploading(true);

      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsed = JSON.parse(user);

      const formData = new FormData();
      formData.append('student_id', parsed.id.toString());
      formData.append('picture', {
        uri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);

      const response = await fetch(API.uploadProfilePicture, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setPicture(data.picture);
        loadProfile();
        Alert.alert('Success', 'Profile picture updated.');
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Something went wrong while uploading your photo.');
    } finally {
      setUploading(false);
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

  const renderField = (
    label: string,
    key: FieldKey,
    icon: keyof typeof Ionicons.glyphMap,
    isLast?: boolean
  ) => (
    <View style={[styles.fieldRow, isLast && styles.fieldRowLast]}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={13} color={COLORS.gray} style={styles.labelIcon} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {editing ? (
       <TextInput
        style={styles.input}
        value={form[key]}
        onChangeText={(text) => {
          if (key === 'year_level') {
            updateField(key, text.replace(/[^0-9]/g, ''));
          } else {
            updateField(key, text);
          }
        }}
        placeholder={`Enter ${label.toLowerCase()}`}
        placeholderTextColor={COLORS.accent}
        keyboardType={key === 'year_level' ? 'numeric' : 'default'}
        maxLength={key === 'year_level' ? 1 : undefined}
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
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            <TouchableOpacity
              style={styles.avatarWrap}
              activeOpacity={0.85}
              onPress={pickImage}
              disabled={uploading}
            >
              <View style={styles.avatar}>
                {picture ? (
                  <Image
                    source={{ uri: `${API_URL}/${picture}` }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {getInitials(form.full_name || 'Student')}
                  </Text>
                )}
              </View>
              <View style={styles.cameraBadge}>
                <Ionicons
                  name={uploading ? 'ellipsis-horizontal' : 'camera'}
                  size={13}
                  color="#fff"
                />
              </View>
            </TouchableOpacity>

            <View style={styles.identityInfo}>
              <Text style={styles.identityName} numberOfLines={1}>
                {form.full_name || 'Student'}
              </Text>
              <View style={styles.srCodeChip}>
                <Ionicons name="school-outline" size={11} color={COLORS.secondary} />
                <Text style={styles.srCodeText}>
                  {student?.sr_code ?? 'No SR-Code'}
                </Text>
              </View>
            </View>

            {!editing && (
              <TouchableOpacity
                style={styles.quickEditButton}
                onPress={() => setEditing(true)}
                activeOpacity={OPACITY.pressed}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="create-outline" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Details card */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="person-outline" size={13} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionLabel}>Personal Details</Text>
          </View>

          {renderField('Full Name', 'full_name', 'person-outline')}

          <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="library-outline" size={13} color={COLORS.primary} />
            </View>
            <Text style={styles.sectionLabel}>Academic Details</Text>
          </View>

          {renderField('College Name', 'college_name', 'business-outline')}
          {renderField('Program', 'program', 'book-outline')}
          {renderField('Year Level', 'year_level', 'layers-outline', true)}
        </View>

        {/* Actions */}
        {editing && (
          <View style={styles.editRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing} activeOpacity={OPACITY.pressed}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={saveProfile} activeOpacity={OPACITY.pressed}>
              <Ionicons name="checkmark" size={17} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.saveText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sign out */}
        {!editing && (
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={OPACITY.pressed}
          >
            <Ionicons name="log-out-outline" size={17} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        )}
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
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // ----- Cards -----
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.creamDark,
    ...SHADOWS.sm,
  },
  identityCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.creamDark,
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
    ...SHADOWS.sm,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs + 2,
  },
  sectionHeaderSpaced: {
    marginTop: SPACING.md,
  },
  sectionIconWrap: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm - 2,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs + 2,
  },
  sectionLabel: {
    ...TYPOGRAPHY.eyebrow,
    fontSize: 11,
    color: COLORS.primary,
  },

  // ----- Identity header -----
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    marginRight: SPACING.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.accentSoft,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  identityInfo: {
    flex: 1,
  },
  identityName: {
    ...TYPOGRAPHY.title,
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  srCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accentSoft,
    gap: 5,
  },
  srCodeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.secondary,
    textTransform: 'none',
  },
  quickEditButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ----- Fields -----
  fieldRow: {
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.creamDark,
  },
  fieldRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  labelIcon: {
    marginRight: SPACING.xs,
  },
  label: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.gray,
  },
  value: {
    ...TYPOGRAPHY.body,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.cream,
  },

  // ----- Buttons -----
  editRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  cancelText: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.glow,
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  logoutText: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.primary,
    fontSize: 15,
  },
});