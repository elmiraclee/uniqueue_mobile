import { getSessionToken } from '@/utils/client-fetch';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { COLORS } from '../../constants/theme';

export default function ParentTabsLayout() {
  const insets=useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const role = await AsyncStorage.getItem('role');
        const user = await AsyncStorage.getItem('user');
        const token = await getSessionToken();
        if (!cancelled) setIsLoggedIn(!!token && !!user && role === 'parent');
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

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          height: 60 + Math.max(insets.bottom, 8),
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
        },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="add-child"
        options={{
          title: 'Add',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-add-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{ href: null, title: 'Transactions' }}
      />
      <Tabs.Screen
        name="office-queue"
        options={{ href: null, title: 'Office Queue' }}
      />
      <Tabs.Screen
        name="live-queue"
        options={{ href: null, title: 'Live Queue' }}
      />
      <Tabs.Screen
        name="live-monitor"
        options={{ href: null, title: 'Live Monitor' }}
      />
      <Tabs.Screen
        name="ticket"
        options={{ href: null, title: 'Ticket' }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
