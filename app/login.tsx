import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import CustomButton from '../components/ui/custom-button';
import CustomInput from '../components/ui/custom-input';
import { API } from "../constants/backend";
import { COLORS } from '../constants/theme';

export default function Login() {
  const router = useRouter();

  const [srCode, setSrCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!srCode.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
      API.login,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: srCode,
          password: password,
        }),
      }
    );

      console.log('HTTP STATUS:', response.status);

      const text = await response.text();

      console.log('RAW RESPONSE:', text);

      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        Alert.alert(
          'Server Error',
          'Invalid JSON response from server'
        );
        return;
      }

      console.log('LOGIN RESPONSE:', data);

      if (!data.success) {
        Alert.alert(
          'Login Failed',
          data.message || 'Invalid credentials'
        );
        return;
      }

      await AsyncStorage.setItem(
        'user',
        JSON.stringify(data.user)
      );

      await AsyncStorage.setItem(
        'role',
        data.role
      );

      Alert.alert(
        'Success',
        `Logged in as ${data.role}`
      );

      // ROUTING
      if (data.role === 'student') {
        router.replace('/student/home');
      }
      else if (data.role === 'office') {
        router.replace('/office/home');
      }
      else if (data.role === 'admin') {
        router.replace('/admin/home');
      }
      else {
        Alert.alert(
          'Error',
          'Unknown user role'
        );
      }
    } catch (error) {
      console.log('LOGIN ERROR:', error);

      Alert.alert(
        'Connection Error',
        'Cannot connect to server'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>

        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
        />

        <Text style={styles.title}>
          UniQueue
        </Text>

        <Text style={styles.subtitle}>
          Sign in using your SR-Code
        </Text>

        <CustomInput
          placeholder="SR-Code/Username"
          value={srCode}
          onChangeText={setSrCode}
        />

        <CustomInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <CustomButton
          title={loading ? 'Logging in...' : 'Login'}
          onPress={handleLogin}
        />

        <Pressable
          onPress={() => router.push('/signup')}
        >
          <Text style={styles.signup}>
            Don't have an account? Sign Up
          </Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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

  signup: {
    textAlign: 'center',
    marginTop: 20,
    color: COLORS.primary,
    fontWeight: '600',
  },
});