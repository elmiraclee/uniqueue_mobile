import { useState } from 'react';
import { Modal,ScrollView,View,Text,Pressable,StyleSheet } from 'react-native';
import CSMForm from './csm-form';
import { COLORS } from '@/constants/theme';
import type { PendingFeedbackTransaction } from './feedback-modal';
import { CSMValues } from '@/utils/csm';
export default function CSMModal({visible,transaction,onClose,onSubmitted,submit}:{visible:boolean;transaction:PendingFeedbackTransaction|null;onClose:()=>void;onSubmitted:()=>void;submit:(values:CSMValues)=>Promise<{success:boolean;message?:string}>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <Modal visible={visible} animationType="slide" onRequestClose={()=>{if(!busy)onClose();}}><View style={{flex:1,backgroundColor:'#fff'}}><View style={s.header}><Text style={s.title}>CSM · {transaction?.queue_number}</Text><Pressable disabled={busy} accessibilityLabel="Close CSM" accessibilityRole="button" onPress={onClose} style={s.close}><Text style={s.title}>×</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,paddingBottom:48}}>{transaction&&<CSMForm key={transaction.ticket_id} office={transaction.office_name} service={transaction.service_availed} busy={busy} error={error} onSubmit={async values=>{if(busy)return;setBusy(true);setError('');try{const data=await submit(values);if(data.success){onSubmitted();onClose()}else setError(data.message||'Could not save CSM. Please try again.')}catch{setError('Connection failed. Your answers are kept. Try again.')}finally{setBusy(false)}}}/>}</ScrollView></View></Modal>;
}
const s=StyleSheet.create({header:{padding:16,paddingTop:44,backgroundColor:COLORS.primary,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:20,lineHeight:26,fontWeight:'700',color:'#fff'},close:{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'}});
