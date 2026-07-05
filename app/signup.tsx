import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';

import CustomButton from '../components/ui/custom-button';
import CustomInput from '../components/ui/custom-input';
import { COLORS } from '../constants/theme';

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
      const response = await fetch(
        'http://192.168.1.26/uniqueue_api/get_colleges.php'
      );

      const data = await response.json();
      setColleges(data);

    } catch (error) {
      console.log('COLLEGES ERROR:', error);
    }
  };

  const fetchPrograms = async (id: string) => {
    try {
      const response = await fetch(
        `http://192.168.1.26/uniqueue_api/get_programs.php?college_id=${id}`
      );

      const data = await response.json();

      setPrograms(data);

    } catch (error) {
      console.log('PROGRAMS ERROR:', error);
    }
  };

  const handleSignup = async () => {

    if (
      !srCode.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !password.trim() ||
      !collegeId ||
      !programId
    ) {
      Alert.alert(
        'Error',
        'Please complete all fields.'
      );
      return;
    }

    try {

      setLoading(true);

      const response = await fetch(
        'http://192.168.1.26/uniqueue_api/signup.php',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            sr_code: srCode,
            first_name: firstName,
            last_name: lastName,
            college_id: Number(collegeId),
            program_id: Number(programId),
            password: password,
          }),
        }
      );

      const text = await response.text();

      console.log(text);

      const data = JSON.parse(text);

      if (data.success) {

        Alert.alert(
          'Success',
          'Account created successfully!',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace('/login'),
            },
          ]
        );

      } else {

        Alert.alert(
          'Signup Failed',
          data.message
        );

      }

    } catch (error) {

      console.log(error);

      Alert.alert(
        'Error',
        'Cannot connect to server'
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>

          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
          />

          <Text style={styles.title}>
            UniQueue
          </Text>

          <Text style={styles.subtitle}>
            Create your student account
          </Text>

          <CustomInput
            placeholder="SR-Code"
            value={srCode}
            onChangeText={setSrCode}
          />

          <CustomInput
            placeholder="First Name"
            value={firstName}
            onChangeText={setFirstName}
          />

          <CustomInput
            placeholder="Last Name"
            value={lastName}
            onChangeText={setLastName}
          />

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={collegeId}
              onValueChange={(itemValue) => {
                setCollegeId(itemValue);
                setProgramId('');
              }}
            >
              <Picker.Item
                label="Select College"
                value=""
              />

              {colleges.map((college) => (
                <Picker.Item
                  key={college.college_id}
                  label={college.college_name}
                  value={college.college_id.toString()}
                />
              ))}
            </Picker>
          </View>

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={programId}
              onValueChange={(itemValue) =>
                setProgramId(itemValue)
              }
            >
              <Picker.Item
                label="Select Program"
                value=""
              />

              {programs.map((program) => (
                <Picker.Item
                  key={program.program_id}
                  label={program.program_name}
                  value={program.program_id.toString()}
                />
              ))}
            </Picker>
          </View>

          <CustomInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <CustomButton
            title={
              loading
                ? 'Creating Account...'
                : 'Sign Up'
            }
            onPress={handleSignup}
          />

          <Text
            style={styles.linkText}
            onPress={() =>
              router.push('/login')
            }
          >
            Already have an account? Login
          </Text>

        </View>
      </ScrollView>
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

  pickerContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },

  linkText: {
    textAlign: 'center',
    marginTop: 20,
    color: COLORS.primary,
    fontWeight: '600',
  },

});