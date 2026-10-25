import { getSessionToken } from '@/utils/client-fetch';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';

import { COLORS } from '@/constants/theme';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await AsyncStorage.getItem('user');
        const token = await getSessionToken();
        const r = await AsyncStorage.getItem('role');
        if (!cancelled) {
          setIsLoggedIn(!!token && !!user);
          setRole(r);
        }
      } catch {
        if (!cancelled) setIsLoggedIn(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href={role === 'parent' ? '/parent/home' : '/student/home'} />;
  }

  return <Redirect href="/login" />;
}
