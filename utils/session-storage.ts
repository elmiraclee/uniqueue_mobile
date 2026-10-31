import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { API_URL } from '@/constants/backend';
// SecureStore keys permit only letters, digits, '.', '-' and '_'. A raw
// URL contains forbidden ':' and '/' characters. Fixed-width UTF-16 hex
// preserves per-API isolation without punctuation collisions or async setup.
const encodedApi = API_URL.split('')
  .map(char => char.charCodeAt(0).toString(16).padStart(4, '0'))
  .join('');
const SESSION_KEY = `uniqueue-session-v3.${encodedApi}`;

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

// Failed/offline logout is retained encrypted, independently of the live session.
const PENDING_LOGOUT_KEY = 'uniqueue-pending-logout-v1';
let flush: Promise<void> | null = null;
// Serialize pending-revocation reads/writes so a retry cannot erase a new logout.
let pendingMutation: Promise<unknown> = Promise.resolve();
function withPendingLock<T>(work: () => Promise<T>): Promise<T> {
 const next = pendingMutation.then(work, work);
 pendingMutation = next.then(() => undefined, () => undefined);
 return next;
}
export async function queuePendingLogout(token: string, pushToken: string) {
 return withPendingLock(async () => {
 const raw=await SecureStore.getItemAsync(PENDING_LOGOUT_KEY);
 const rows: {token:string;pushToken:string}[]=raw?JSON.parse(raw):[];
 if(!rows.some(r=>r.token===token))rows.push({token,pushToken});
 await SecureStore.setItemAsync(PENDING_LOGOUT_KEY,JSON.stringify(rows));
 });
}
export async function flushPendingLogout(): Promise<void> {
 // Web cannot persist old bearer tokens securely. It remains an explicitly online logout.
 if(Platform.OS==='web')return;
 if(flush)return flush;
 flush=withPendingLock(async()=>{
  const raw=await SecureStore.getItemAsync(PENDING_LOGOUT_KEY);if(!raw)return;
  const rows: {token:string;pushToken:string}[]=JSON.parse(raw);const pending=[];
  for(const row of rows){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
   try{const r=await fetch(API_URL+'/logout.php',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+row.token},body:JSON.stringify({push_token:row.pushToken}),signal:controller.signal});
    if(!r.ok&&r.status!==401)pending.push(row);
   }catch{pending.push(row);}finally{clearTimeout(timeout);}
  }
  if(pending.length)await SecureStore.setItemAsync(PENDING_LOGOUT_KEY,JSON.stringify(pending));else await SecureStore.deleteItemAsync(PENDING_LOGOUT_KEY);
 }).finally(()=>{flush=null;});return flush;
}
