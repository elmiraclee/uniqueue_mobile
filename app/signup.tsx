import { gradeChoices, useGradeOptions } from '@/hooks/use-grade-options';
import { clientAlert } from '@/components/client/client-ui';
import { clientFetch } from '@/utils/client-fetch';
import { useClientUI } from '@/components/client/client-ui';
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

import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import CustomButton from '../components/ui/custom-button';
import GoogleLogo from '../components/ui/google-logo';
import CustomInput from '../components/ui/custom-input';
import { API } from '../constants/backend';
import {
  completeGoogleAuth,
  useGoogleAuthRequest,
  type GoogleProfile,
} from '@/utils/google-auth';
import { registerPushToken } from '@/components/notification/push';
import PasswordChecklist from '@/components/ui/password-checklist';
import { passwordError } from '@/utils/password';
import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../constants/theme';

type SchoolLevel = 'Elementary' | 'JHS' | 'SHS' | 'College';

const SCHOOL_LEVELS: { label: string; value: SchoolLevel }[] = [
  { label: 'Elementary', value: 'Elementary' },
  { label: 'Junior High School (JHS)', value: 'JHS' },
  { label: 'Senior High School (SHS)', value: 'SHS' },
  { label: 'College', value: 'College' },
];

// College year level sent to the API, derived from the grade / year pick.


const SR_CODE_PATTERN = /^\d{2}-\d{5}$/;
const NAME_PATTERN = /^[A-Za-zÑñ' -]{1,50}$/;

export default function Signup() {
  const clientUI=useClientUI();
  const router = useRouter();

  const [srCode, setSrCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [collegeId, setCollegeId] = useState('');
  const [programId, setProgramId] = useState('');

  const [colleges, setColleges] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);

  const [email, setEmail] = useState('');
  const [yearLevel, setYearLevel] = useState('');

  // Multi school-level support (web auth/signup.php parity). College is
  // the only level that carries college / program / college year level.
  const gradeCatalog=useGradeOptions();
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('College');
  const [gradeYear, setGradeYear] = useState('');
  const [consent, setConsent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googlePending, setGooglePending] = useState<GoogleProfile | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    request: googleRequest,
    response: googleResponse,
    promptAsync: promptGoogle,
    ready: googleReady,
  } = useGoogleAuthRequest();


  useEffect(() => {
    fetchColleges();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('google_pending');
        if (raw) {
          const pending = JSON.parse(raw) as GoogleProfile;
          setGooglePending(pending);
          if (pending.first_name) setFirstName(pending.first_name);
          if (pending.last_name) setLastName(pending.last_name);
          if (pending.email) setEmail(pending.email);
        }
      } catch {}
    })();
  }, []);

  // Google button on signup screen (same as web "Continue with Google")
  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      (async () => {
        setGoogleLoading(true);
        try {
          const result = await completeGoogleAuth(googleResponse.authentication);
          if (!result.ok) {
            clientAlert('Google Sign-Up', result.message);
            return;
          }
          if (result.action === 'login') {
            await AsyncStorage.removeItem('google_pending');
            await AsyncStorage.setItem('user', JSON.stringify(result.user));
            await AsyncStorage.setItem('role', 'student');
            const id = Number(result.user?.id ?? result.user?.student_id ?? 0);
            if (id) await registerPushToken({ role: 'student', id });
            router.replace('/student/home');
            return;
          }
          setGooglePending(result.google);
          setFirstName(result.google.first_name || '');
          setLastName(result.google.last_name || '');
          setEmail(result.google.email || '');
          await AsyncStorage.setItem('google_pending', JSON.stringify(result.google));
        } catch (e) {
          console.log(e);
          clientAlert('Google Sign-Up', 'Something went wrong.');
        } finally {
          setGoogleLoading(false);
        }
      })();
    }
  }, [googleResponse]);

  useEffect(() => {
    if (collegeId) {
      fetchPrograms(collegeId);
    }
  }, [collegeId]);

  const fetchColleges = async () => {
    try {
      const response = await clientFetch(API.getColleges);
      const data = await response.json();
      setColleges(data);
    } catch (error) {
      console.log('COLLEGES ERROR:', error);
    }
  };

  const fetchPrograms = async (id: string) => {
    try {
      const response = await clientFetch(`${API.getPrograms}?college_id=${id}`);
      const data = await response.json();
      setPrograms(data);
    } catch (error) {
      console.log('PROGRAMS ERROR:', error);
    }
  };

  // Reset the grade / year pick whenever the school level changes so an
  // Elementary child can't keep a "3rd Year" selection.
  useEffect(() => {
    setGradeYear('');
    if (schoolLevel !== 'College') {
      setCollegeId('');
      setProgramId('');
      setYearLevel('');
    }
  }, [schoolLevel]);

  // College year level is derived from the grade / year selection.
  useEffect(() => {
    if (schoolLevel !== 'College') return;
    setYearLevel(String(gradeCatalog.grades.find(g=>g.school_level===schoolLevel&&g.value===gradeYear)?.year_level??''));
  }, [schoolLevel, gradeYear, gradeCatalog.grades]);

  const isCollege = schoolLevel === 'College';

  const handleSignup = async () => {
    if(gradeCatalog.loading||gradeCatalog.error)return clientAlert('Grade choices','Load the current grade choices before signing up.');
    const isGoogle = !!googlePending;
    if (
      !srCode.trim() ||
      !email.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !gradeYear ||
      (isCollege && (!collegeId || !programId)) ||
      (!isGoogle && !password.trim())
    ) {
      clientAlert('Error', 'Please complete all fields.');
      return;
    }

    if (!SR_CODE_PATTERN.test(srCode.trim())) {
      clientAlert('Invalid SR-Code', 'Use the format YY-NNNNN (e.g. 23-12345).');
      return;
    }

    if (!NAME_PATTERN.test(firstName.trim()) || !NAME_PATTERN.test(lastName.trim())) {
      clientAlert(
        'Invalid name',
        'Names may only contain letters, spaces, apostrophes, and hyphens.'
      );
      return;
    }

    if (!isGoogle) {
      const pwErr = passwordError(password);
      if (pwErr) {
        clientAlert('Weak password', pwErr);
        return;
      }
      if (password !== confirmPassword) {
        clientAlert('Password', 'Passwords do not match.');
        return;
      }
    }

    if (!consent) {
      clientAlert(
        'Consent required',
        'You must agree to the Terms of Use and Privacy Notice to create an account.'
      );
      return;
    }

    try {
      setLoading(true);

      const response = await clientFetch(API.signup, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sr_code: srCode.trim(),
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          school_level: schoolLevel,
          grade_year: gradeYear,
          // Elementary / JHS / SHS students have no college record.
          college_id: isCollege ? Number(collegeId) : null,
          program_id: isCollege ? Number(programId) : null,
          year_level: isCollege && yearLevel ? Number(yearLevel) : null,
          password: isGoogle ? (password || '') : password,
          confirm_password: isGoogle ? undefined : confirmPassword,
          google_signup: isGoogle ? 1 : 0,
          google_registration_token: isGoogle ? googlePending?.registration_token : undefined,
          google_id: isGoogle ? googlePending?.google_id : undefined,
          google_picture: isGoogle ? googlePending?.picture : undefined,
        }),
      });

      const text = await response.text();


      const data = JSON.parse(text);

      if (data.success) {
        await AsyncStorage.removeItem('google_pending');
        if (data.user) {
          await AsyncStorage.setItem('user', JSON.stringify(data.user));
          await AsyncStorage.setItem('role', 'student');
          const id = Number(data.user?.id ?? data.user?.student_id ?? 0);
          if (id) await registerPushToken({ role: 'student', id });
          await AsyncStorage.setItem('client_tour_new',`student:${data.user.id}`);
          clientUI.success({title:'Account created successfully',message:'Your account is ready. You can now join an office queue and follow your transactions.',confirmLabel:'Continue to Dashboard',onConfirm:()=>router.replace('/student/home')});
        } else {
          clientAlert('Success', 'Account created successfully!', [
            { text: 'OK', onPress: () => router.replace('/login') },
          ]);
        }
      } else {
        clientAlert('Signup Failed', data.message);
      }
    } catch (error) {
      console.log(error);
      clientAlert('Error', 'Cannot connect to server');
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchColleges();
    } finally {
      setRefreshing(false);
    }
  };

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
            
        {googlePending ? (
          <View style={styles.googleBanner}>
            <Text style={styles.googleBannerText}>
              Signed in with Google as{' '}
              <Text style={{ fontWeight: '700' }}>{googlePending.email}</Text>
            </Text>
            <Pressable
              onPress={async () => {
                setGooglePending(null);
                await AsyncStorage.removeItem('google_pending');
              }}
            >
              <Text style={styles.googleBannerLink}>Not you? Use a different method</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={[styles.googleButton, googleLoading && styles.googleButtonDisabled]}
              disabled={googleLoading || loading}
              onPress={async () => {
                if (!googleReady || !googleRequest) {
                  clientAlert(
                    'Google Sign-Up',
                    'Set GOOGLE_WEB_CLIENT_ID in constants/backend.ts, then restart Expo.'
                  );
                  return;
                }
                try {
                  setGoogleLoading(true);
                  await promptGoogle();
                } catch (e) {
                  console.log(e);
                  clientAlert('Google Sign-Up', 'Could not open Google sign-in.');
                } finally {
                  setGoogleLoading(false);
                }
              }}
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
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or fill the form</Text>
              <View style={styles.orLine} />
            </View>
          </>
        )}

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
            {gradeCatalog.loading&&<Text>Loading grade choices…</Text>}
            {!!gradeCatalog.error&&<><Text style={{color:'#ad2132',fontSize:14}}>{gradeCatalog.error}</Text><CustomButton title="Retry grade choices" outlined onPress={()=>void gradeCatalog.reload()}/></>}

            {renderPickerField(
              'School Level',
              schoolLevel,
              (value) => setSchoolLevel(value as SchoolLevel),
              SCHOOL_LEVELS
            )}

            {renderPickerField(
              'Grade / Year Level',
              gradeYear,
              setGradeYear,
              [
                { label: 'Select grade / year level', value: '' },
                ...gradeChoices(gradeCatalog.grades,schoolLevel).map(g=>({label:g.label,value:g.value})),
              ]
            )}

            {isCollege && (
            <>
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
              <View style={styles.rowItemWide}>
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
            </View>
            </>
            )}
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
            {!googlePending && (
              <>
                <CustomInput
                  placeholder="Confirm password"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <PasswordChecklist password={password} confirm={confirmPassword} />
              </>
            )}
          </View>

          {/* Terms / Privacy consent — required on the web too */}
          <Pressable
            style={styles.consentRow}
            onPress={() => setConsent(!consent)}
          >
            <View style={[styles.consentBox, consent && styles.consentBoxChecked]}>
              {consent && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.consentText}>
              I agree to the Terms of Use and Privacy Notice.
            </Text>
          </Pressable>

          <CustomButton
            title={loading ? 'Creating Account...' : (googlePending ? 'Finish Creating Account' : 'Sign Up')}
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
  rowItemWide: {
    flex: 1,
  },

  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: 2,
  },
  consentBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentBoxChecked: {
    backgroundColor: COLORS.primary,
  },
  consentText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
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

  googleBanner: {
    backgroundColor: 'rgba(66,133,244,0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(66,133,244,0.2)',
  },
  googleBannerText: {
    color: COLORS.text,
    fontSize: 13,
    marginBottom: 6,
  },
  googleBannerLink: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
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
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
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
});