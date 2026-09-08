import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';

import { COLORS } from '@/constants/theme';

/**
 * Entry gate: keep the student logged in across app reloads / pull-to-refresh.
 * Only send them to login when there is no stored session.
 * Explicit sign-out (with confirmation) clears AsyncStorage elsewhere.
 */
export default function Index() {
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = await AsyncStorage.getItem('user');
        if (!cancelled) {
          setIsLoggedIn(!!user);
        }
      } catch {
        if (!cancelled) setIsLoggedIn(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href="/student/home" />;
  }

  return <Redirect href="/login" />;
}
