import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_KEY = 'uniqueue-session-v1';

// Keep storage independent of fetch, navigation, and widget helpers.
export async function getSessionToken(): Promise<string | null> {
  return Platform.OS === 'web'
    ? AsyncStorage.getItem(SESSION_KEY)
    : SecureStore.getItemAsync(SESSION_KEY);
}

export async function saveSessionToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(SESSION_KEY, token);
  } else {
    await SecureStore.setItemAsync(SESSION_KEY, token);
  }
}

export async function clearSessionToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(SESSION_KEY);
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}
