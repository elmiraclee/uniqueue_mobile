import { Stack } from 'expo-router';

import { NotificationProvider } from '../components/notification/use-notification';

export default function RootLayout() {
  return (
    <NotificationProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="parent-signup" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="student" />
        <Stack.Screen name="parent" />
      </Stack>
    </NotificationProvider>
  );
}
