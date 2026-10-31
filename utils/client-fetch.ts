import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { stopQueueAlarm } from './queue-alerts';
import { API_URL } from '@/constants/backend';
import { clearLiveTicketWidget } from './live-ticket-widget';
import { clearSessionToken, getSessionToken, saveSessionToken, queuePendingLogout, flushPendingLogout } from './session-storage';
export { getSessionToken } from './session-storage';

export async function clearClientSession() {
  stopQueueAlarm();
  await clearSessionToken();
  await AsyncStorage.multiRemove(['user','role','google_pending','push_token_registered_for']);
  await clearLiveTicketWidget();
  try {
    const { getNotifications } = await import('../components/notification/push');
    const n=getNotifications();
    await n?.cancelAllScheduledNotificationsAsync();
    await n?.dismissAllNotificationsAsync();
  } catch { /* Native notifications are optional. */ }
}
export async function logoutClient() {
  const token=await getSessionToken();
  const cached=await AsyncStorage.getItem('push_token_registered_for');
  const pushToken=cached?.split(':').slice(2).join(':') || '';
  if(Platform.OS==='web'){
    const response=await clientFetch(API_URL+'/logout.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({push_token:pushToken})});
    if(!response.ok)throw new Error('Could not confirm logout. Reconnect and retry.');
  }else if(token){await queuePendingLogout(token,pushToken);void flushPendingLogout();}
  await clearClientSession();router.replace('/login');
}
export async function clientFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response> {
  const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  const scoped=url.startsWith(API_URL.replace(/\/$/,'')+'/');
  const token=scoped?await getSessionToken():null;
  const headers=new Headers(init?.headers || (typeof input==='object'&&'headers' in input?input.headers:undefined));
  if(scoped&&token)headers.set('Authorization','Bearer '+token);
  const controller=new AbortController();
  const upstream=init?.signal || (typeof input==='object'&&'signal' in input?input.signal:null);
  const abort=()=>controller.abort();
  if(upstream?.aborted)controller.abort();else upstream?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,20000);
  let response: Response;
  try { response=await globalThis.fetch(input,{...init,headers,signal:controller.signal}); }
  finally { clearTimeout(timer);upstream?.removeEventListener('abort',abort); }
  if(scoped) {
    if(response.status===401&&token&&await getSessionToken()===token) { await clearClientSession();router.replace('/login'); }
    if(/\/(login|parent_login|signup|parent_signup|google_auth|activate_student)\.php(?:\?|$)/.test(url)&&response.ok) {
      try {const data=await response.clone().json();if(data.success&&typeof data.access_token==='string')await saveSessionToken(data.access_token);}catch{}
    }
  }
  return response;
}
