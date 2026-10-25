import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { API_URL } from '@/constants/backend';
import { clearLiveTicketWidget } from './live-ticket-widget';
import { clearSessionToken, getSessionToken, saveSessionToken } from './session-storage';

// Preserve existing imports from client-fetch in screens and components.
export { getSessionToken } from './session-storage';
export async function clearClientSession(){await clearSessionToken();await AsyncStorage.multiRemove(['user','role','google_pending']);await clearLiveTicketWidget()}
export async function logoutClient(){try{await clientFetch(API_URL+'/logout.php',{method:'POST'})}finally{await clearClientSession();router.replace('/login')}}
export async function clientFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
 const scoped=url.startsWith(API_URL.replace(/\/$/,'')+'/');
 const token=scoped?await getSessionToken():null;
 const headers=new Headers(init?.headers || (typeof input==='object'&&'headers' in input?input.headers:undefined));
 if(scoped&&token)headers.set('Authorization','Bearer '+token);
 const response=await globalThis.fetch(input,{...init,headers});
 if(scoped){
  if(response.status===401&&token&&await getSessionToken()===token){await clearClientSession();router.replace('/login')}
  if(/\/(login|parent_login|signup|parent_signup|google_auth|activate_student)\.php(?:\?|$)/.test(url)&&response.ok){
   try{const data=await response.clone().json();if(data.success&&typeof data.access_token==='string')await saveSessionToken(data.access_token)}catch{}
  }
 }
 return response;
}
