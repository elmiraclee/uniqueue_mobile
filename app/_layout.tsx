// Must be the FIRST import: defines the headless background push handler
// before the rest of the bundle loads (needed for killed-app delivery).
import '../components/notification/background-task';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TutorialProvider } from '../components/tutorial/tutorial';
import { ClientUIProvider } from '../components/client/client-ui';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants/backend';
import { clearClientSession } from '@/utils/client-fetch';
import { ActivityIndicator, View, Text } from 'react-native';

import { NotificationProvider } from '../components/notification/use-notification';

export default function RootLayout() {
  const [ready,setReady]=useState(false);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{let mounted=true;
    (async()=>{try {
      const previous=await AsyncStorage.getItem('deployment_api_origin');
      if(previous!==API_URL) { await clearClientSession();await AsyncStorage.setItem('deployment_api_origin',API_URL); }
      if(mounted)setReady(true);
    } catch { if(mounted)setFailed(true); }})();
    return()=>{mounted=false;};
  },[]);
  if(!ready)return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>{failed?<Text>Unable to initialize secure session storage. Restart the app to retry.</Text>:<ActivityIndicator/>}</View>;
  return (
    <SafeAreaProvider><ClientUIProvider><TutorialProvider><NotificationProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="parent-signup" />
        <Stack.Screen name="activate-account" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="student" />
        <Stack.Screen name="parent" />
      </Stack>
    </NotificationProvider></TutorialProvider></ClientUIProvider></SafeAreaProvider>
  );
}
