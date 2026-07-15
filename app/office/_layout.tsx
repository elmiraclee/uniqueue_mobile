import { Text } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Tabs, useSegments } from 'expo-router';

import { COLORS } from '../../constants/theme';

export default function OfficeLayout() {
  const segments = useSegments();
  const isInConfig = segments.some(s => s === 'config');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />

      {/* configuration index is hidden — config/document IS the tab */}
      <Tabs.Screen
        name="configuration"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="config/document"
        options={{
          title: 'Configuration',
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="settings"
              size={size}
              color={isInConfig ? COLORS.primary : color}
            />
          ),
          tabBarLabel: ({ color }) => (
            <Text style={{ color: isInConfig ? COLORS.primary : color, fontSize: 10 }}>
              Configuration
            </Text>
          ),
        }}
      />

      <Tabs.Screen
        name="config/window"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="config/staff"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="config/capacity"
        options={{ href: null }}
      />
    </Tabs>
  );
}