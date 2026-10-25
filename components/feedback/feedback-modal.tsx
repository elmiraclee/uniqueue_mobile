import { useEffect,useState } from 'react';
import { Text,View,Modal,Pressable,ActivityIndicator } from 'react-native';
import CSMModal from './csm-modal';
import { API_URL } from '@/constants/backend';
import { clientFetch } from '@/utils/client-fetch';
import { CSMValues } from '@/utils/csm';
export interface PendingFeedbackTransaction {ticket_id:number;queue_number:string;type:string;office_name:string;done_at:string|null;created_at:string;service_availed?:string}
export default function FeedbackModal({visible,transaction,studentId,onClose,onSubmitted}:{visible:boolean;transaction:PendingFeedbackTransaction|null;studentId:number;onClose:()=>void;onSubmitted:()=>void}){
 const [context,setContext]=useState<PendingFeedbackTransaction|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;setContext(null);setError('');if(visible&&transaction){clientFetch(API_URL+'/get_csm_context.php?ticket_id='+transaction.ticket_id).then(r=>r.json()).then(d=>{if(!alive)return;if(d.success&&d.transaction)setContext({...transaction,...d.transaction});else setError(d.message||'This transaction is no longer available for CSM.')}).catch(()=>{if(alive)setError('Could not load the CSM details. Please try again.')})}return()=>{alive=false}},[visible,transaction?.ticket_id,retry]);
 if(!visible)return null;
 if(!context)return <Modal visible onRequestClose={onClose}><View style={{padding:28,paddingTop:64,gap:20}}>{error?<><Text>{error}</Text><Pressable onPress={()=>setRetry(v=>v+1)} style={{padding:16}}><Text>Try again</Text></Pressable></>:<ActivityIndicator/>}<Pressable onPress={onClose} style={{padding:16}}><Text>Close</Text></Pressable></View></Modal>;
 return <CSMModal visible transaction={context} onClose={onClose} onSubmitted={onSubmitted} submit={async(values:CSMValues)=>{const response=await clientFetch(API_URL+'/submit_feedback.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...values,ticket_id:context.ticket_id,student_id:studentId})});return response.json()}}/>;
}
