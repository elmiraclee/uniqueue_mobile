import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';

import CustomButton from '../components/ui/custom-button';
import CustomInput from '../components/ui/custom-input';
import { API } from '../constants/backend';
import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../constants/theme';

export default function Signup() {
  const router = useRouter();

  const [srCode, setSrCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');

  const [collegeId, setCollegeId] = useState('');
  const [programId, setProgramId] = useState('');

  const [colleges, setColleges] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  const [email, setEmail] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchColleges();
  }, []);

  useEffect(() => {
    if (collegeId) {
      fetchPrograms(collegeId);
    }
  }, [collegeId]);

  const fetchColleges = async () => {
    try {
      const response = await fetch(API.getColleges);
      const data = await response.json();
      setColleges(data);
    } catch (error) {
      console.log('COLLEGES ERROR:', error);
    }
  };

  const fetchPrograms = async (id: string) => {
    try {
      const response = await fetch(`${API.getPrograms}?college_id=${id}`);
      const data = await response.json();
      setPrograms(data);
    } catch (error) {
      console.log('PROGRAMS ERROR:', error);
    }
  };

  const handleSignup = async () => {
    if (
      !srCode.trim() ||
      !email.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !yearLevel ||
      !password.trim() ||
      !collegeId ||
      !programId
    ) {
      Alert.alert('Error', 'Please complete all fields.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(API.signup, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sr_code: srCode,
          email: email,
          first_name: firstName,
          last_name: lastName,
          college_id: Number(collegeId),
          program_id: Number(programId),
          year_level: Number(yearLevel),
          password,
        }),
      });

      const text = await response.text();
      console.log(text);

      const data = JSON.parse(text);

      if (data.success) {
        Alert.alert('Success', 'Account created successfully!', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
      } else {
        Alert.alert('Signup Failed', data.message);
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setLoading(false);
    }
  };

  const renderSectionLabel = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string
  ) => (
    <View style={styles.sectionLabelRow}>
      <Ionicons name={icon} size={12} color={COLORS.primary} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );

  const renderPickerField = (
    label: string,
    selectedValue: string,
    onValueChange: (value: string) => void,
    items: { label: string; value: string }[],
    enabled = true
  ) => (
    <View style={styles.pickerField}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={[styles.pickerContainer, !enabled && styles.pickerDisabled]}>
        <Picker selectedValue={selectedValue} onValueChange={onValueChange} enabled={enabled}>
          {items.map((item) => (
            <Picker.Item key={item.value || item.label} label={item.label} value={item.value} />
          ))}
        </Picker>
      </View>
    </View>
  );

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
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Image source={require('../assets/images/logo.png')} style={styles.logo} />
            <View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Sign up with your student details</Text>
            </View>
          </View>

          {/* Account Details */}
          <View style={styles.panel}>
            {renderSectionLabel('person-outline', 'Account Details')}
            <CustomInput placeholder="SR-Code" value={srCode} onChangeText={setSrCode} />
            <CustomInput
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <CustomInput placeholder="First Name" value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={styles.rowItem}>
                <CustomInput placeholder="Last Name" value={lastName} onChangeText={setLastName} />
              </View>
            </View>
          </View>

          {/* Academic Information */}
          <View style={styles.panel}>
            {renderSectionLabel('library-outline', 'Academic Information')}
            {renderPickerField(
              'College',
              collegeId,
              (value) => {
                setCollegeId(value);
                setProgramId('');
              },
              [
                { label: 'Select College', value: '' },
                ...colleges.map((college) => ({
                  label: college.college_name,
                  value: college.college_id.toString(),
                })),
              ]
            )}
            <View style={styles.row}>
              <View style={styles.rowItem}>
                {renderPickerField(
                  'Program',
                  programId,
                  setProgramId,
                  [
                    { label: 'Select Program', value: '' },
                    ...programs.map((program) => ({
                      label: program.program_name,
                      value: program.program_id.toString(),
                    })),
                  ],
                  !!collegeId
                )}
              </View>
              <View style={styles.rowItemSmall}>
                {renderPickerField('Year', yearLevel, setYearLevel, [
                  { label: 'Yr', value: '' },
                  { label: '1st Year', value: '1' },
                  { label: '2nd Year', value: '2' },
                  { label: '3rd Year', value: '3' },
                  { label: '4th Year', value: '4' },
                ])}
              </View>
            </View>
          </View>

          {/* Security */}
          <View style={styles.panel}>
            {renderSectionLabel('lock-closed-outline', 'Security')}
            <CustomInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <CustomButton
            title={loading ? 'Creating Account...' : 'Sign Up'}
            onPress={handleSignup}
          />

          <Text style={styles.linkText} onPress={() => router.push('/login')}>
            Already have an account? <Text style={styles.linkTextStrong}>Login</Text>
          </Text>
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
    padding: SPACING.sm,
  },

  card: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
    ...SHADOWS.md,
  },

  // ----- Header -----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    marginRight: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.h2,
    fontSize: 17,
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray,
    marginTop: 1,
  },

  // ----- Panels -----
  panel: {
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#EDEDED',
    padding: SPACING.sm + 2,
    marginBottom: SPACING.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: SPACING.xs + 2,
  },
  sectionLabel: {
    ...TYPOGRAPHY.eyebrow,
    fontSize: 10,
    color: COLORS.primary,
  },

  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rowItem: {
    flex: 1.4,
  },
  rowItemSmall: {
    flex: 1,
  },

  pickerField: {
    marginBottom: 0,
  },
  pickerLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: COLORS.gray,
    marginBottom: 3,
  },
  pickerContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  pickerDisabled: {
    opacity: 0.5,
  },

  linkText: {
    textAlign: 'center',
    marginTop: SPACING.sm,
    color: COLORS.gray,
    fontSize: 12,
  },
  linkTextStrong: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});