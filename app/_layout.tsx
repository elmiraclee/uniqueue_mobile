import { Stack } from 'expo-router';

import { NotificationProvider } from '../components/notification/use-notification'; // adjust path if your folder differs

export default function RootLayout() {
  return (
    <NotificationProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
      </Stack>
    </NotificationProvider>
  );
}