import { TourTarget } from '@/components/tutorial/tutorial';
import React,{useState} from 'react';
import { Pressable,Text,View,StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import CustomInput from '../ui/custom-input';
import CustomButton from '../ui/custom-button';
import { CSM_QUESTIONS,CSM_REGIONS,CSM_SCALE,CSMValues,csmErrors,normalizeCSM } from '@/utils/csm';
import { COLORS } from '@/constants/theme';
export default function CSMForm({office,service='',onSubmit,busy=false,error,practice=false}:{office:string;service?:string;onSubmit:(v:CSMValues)=>void;busy?:boolean;error?:string;practice?:boolean}){
 const [v,setV]=useState<CSMValues>({data_sharing_consent:'',respondent_name:'',contact_number:'',age:'',sex:'',region:'',service_availed:service,customer_type:'',cc1:'',cc2:'',cc3:'',sqd8_variant:'',sqd8:'',comment:''});
 const [errors,setErrors]=useState<Record<string,string>>({});
 const set=(k:string,value:string|number)=>{setV(prev=>normalizeCSM({...prev,[k]:value}));setErrors(prev=>({...prev,[k]:''}))};
 const field=(k:string,label:string,max=200,numeric=false)=><View key={k}><Text style={s.label}>{label}</Text><CustomInput accessibilityLabel={label} value={String(v[k]??'')} maxLength={max} keyboardType={numeric?'number-pad':'default'} onChangeText={t=>set(k,t)}/>{errors[k]&&<Text style={s.error}>{errors[k]}</Text>}</View>;
 const choices=(k:string,label:string,options:readonly (readonly [string|number,string])[])=><View style={s.group}><Text style={s.label}>{label}</Text>{options.map(([key,text])=><Pressable key={key} accessibilityRole="radio" accessibilityLabel={text} accessibilityState={{checked:v[k]===key}} onPress={()=>set(k,key)} style={[s.choice,v[k]===key&&s.active]}><Text style={[s.radio,v[k]===key&&{color:COLORS.primary}]}>{v[k]===key?'◉':'○'}</Text><Text style={s.body}>{text}</Text></Pressable>)}{!!errors[k]&&<Text style={s.error}>{errors[k]}</Text>}</View>;
 const rating=(k:string,prompt:string,variant?:string)=>{const val=variant?(v.sqd8_variant===variant?v.sqd8:0):v[k];return <View key={k} style={s.group}><Text style={s.label}>{k.toUpperCase()} · {prompt}</Text><View style={s.scores}>{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityRole="radio" accessibilityState={{checked:val===n}} accessibilityLabel={`${k.toUpperCase()}: ${n} — ${CSM_SCALE[n-1]}`} onPress={()=>{if(variant){setV(p=>({...p,sqd8_variant:variant,sqd8:n}));setErrors(p=>({...p,sqd8:''}))}else set(k,n)}} style={[s.score,val===n&&s.active]}><Text style={{fontSize:16,fontWeight:'700',color:val===n?COLORS.primary:COLORS.text}}>{n}</Text></Pressable>)}</View>{!!val&&<Text style={s.hint}>{CSM_SCALE[Number(val)-1]}</Text>}{!!errors[k]&&<Text style={s.error}>{errors[k]}</Text>}</View>};
 return <View style={{gap:12}}>
 <Text style={s.reference}>BatStateU-FO-CFS-01 · Revision 06{ '\n'}Effectivity: November 3, 2023</Text>
 <TourTarget id="csm"><Text style={s.title}>Client Satisfaction Measurement</Text></TourTarget>
 <Text style={s.body}>Your feedback on your recently concluded transaction helps this office provide better service. Help us serve you better!</Text>
 {practice&&<Text style={s.practice}>Practice only. No feedback will be submitted.</Text>}
 <Text style={s.heading}>Data Privacy Commitment</Text>
 <Text style={s.body}>Pursuant to Republic Act No. 10173, also known as the Data Privacy Act of 2012, Batangas State University, The National Engineering University recognizes its commitment to protect and respect the privacy of its customers and/or stakeholders and ensure that all information collected from them are all processed in accordance with the principles of transparency, legitimate purpose, and proportionality mandated under the Data Privacy Act of 2012.</Text>
 <Text style={s.heading}>Consent of Data Subject</Text><Text style={s.body}>I hereby give my consent and hereby authorize Batangas State University, the National Engineering University to share, disclose, or transfer my personal data with a third party in the pursuit of journalistic, artistic, literary, research or any legal purposes in compliance with the Data Privacy Act of 2012.</Text>
 <TourTarget id="csm-consent">{choices('data_sharing_consent','Third-party data sharing',[[1,'Yes'],[0,'No']])}</TourTarget>
 {field('respondent_name','Name (optional)')}{field('contact_number','Contact number (optional)',40)}
 <Text style={s.hint}>Date and time are recorded by the server in Asia/Manila when submitted.</Text>
 {field('age','Age',3,true)}
 {choices('sex','Sex',[['Male','Male'],['Female','Female'],['Prefer not to say','Prefer not to say']])}
 <Text style={s.label}>Region</Text><View style={s.picker}><Picker style={{minHeight:48,fontSize:16,backgroundColor:'white',color:'#2c2c2c',borderWidth:0,borderRadius:8,width:'100%'}} accessibilityLabel="Region" selectedValue={v.region} onValueChange={val=>set('region',val)}><Picker.Item label="Select region" value=""/>{CSM_REGIONS.map(([key,label])=><Picker.Item key={key} value={key} label={label}/>)}</Picker></View>{!!errors.region&&<Text style={s.error}>{errors.region}</Text>}
 <Text style={s.label}>Office / College visited</Text><Text style={s.body}>{office}</Text>{field('service_availed','Service availed / Nature of transaction',1000)}
 {choices('customer_type','Customer Type',['Employee','Faculty','Student','Alumni','Guest','Parent','Others'].map(t=>[t,t]))}
 {v.customer_type==='Others'&&field('customer_type_other','Specify customer type',120)}
 <TourTarget id="csm-charter"><Text style={s.heading}>Citizen’s Charter</Text>
 {choices('cc1','CC1 · Do you know about the Citizen’s Charter (document of an agency/office’s service and requirements)?',[[1,'Yes, aware before my transaction with this office'],[2,'Yes, but aware only when I saw the CC of this office'],[3,'No, not aware of the CC (skip CC2 and CC3)']])}
 {[1,2].includes(Number(v.cc1))&&choices('cc2','CC2 · Did you see this office’s Citizen Charter?',[[1,'Yes, the CC was easy to find'],[2,'Yes, but the CC was hard to find'],[3,'No, I did not see this office’s CC (skip CC3)']])}
 {[1,2].includes(Number(v.cc1))&&[1,2].includes(Number(v.cc2))&&choices('cc3','CC3 · Did you use the Citizen’s Charter as a guide for the service/s you availed?',[[1,'Yes, I was able to use the CC'],[2,'No, I was not able to use the CC because…']])}
 {Number(v.cc3)===2&&field('cc3_reason','Reason',1000)}
 </TourTarget><TourTarget id="csm-ratings"><Text style={s.heading}>Service Quality</Text><Text style={s.body}>Choose one rating for SQD0–7. For SQD8, evaluate only one criterion. Selecting the other row clears your previous SQD8 choice.</Text>
 <Text style={s.hint}>{CSM_SCALE.map((l,i)=>`${i+1} — ${l}`).join('\n')}</Text>
 {Object.entries(CSM_QUESTIONS).map(([key,prompt])=>rating(key,prompt))}
 {rating('sqd8a','My transaction (including steps, payment and location) was simple and convenient (Access and Facilities)','a')}
 {rating('sqd8b','My online transaction (including steps and payment) was simple and convenient (Access and Facilities)','b')}
 {!!errors.sqd8&&<Text style={s.error}>{errors.sqd8}</Text>}
 </TourTarget><Text style={s.label}>Comments and suggestions (optional)</Text><CustomInput accessibilityLabel="Comments and suggestions" multiline maxLength={2000} value={String(v.comment)} onChangeText={t=>set('comment',t)} style={{minHeight:100,textAlignVertical:'top'}}/>
 <Text style={s.hint}>For inquiries and feedback: Quality Assurance Management – ISO Central Office, (043) 980-0385 local 1116, Student Services Center Building, Pablo Borbon Campus.</Text>
 {!!error&&<Text accessibilityLiveRegion="assertive" style={s.error}>{error}</Text>}
 {!!Object.keys(errors).filter(k=>errors[k]).length&&<Text accessibilityLiveRegion="assertive" style={s.error}>Please review the highlighted fields above. Your answers are kept.</Text>}
 <CustomButton title={practice?'Practice — submission disabled':'Submit CSM'} loading={busy} disabled={practice} onPress={()=>{const e=csmErrors(v);setErrors(e);if(!Object.keys(e).length)onSubmit(normalizeCSM(v))}}/>
 </View>;
}
const s=StyleSheet.create({reference:{fontSize:14,lineHeight:20,color:'#625b5d'},title:{fontSize:24,lineHeight:30,fontWeight:'700',color:COLORS.text},heading:{fontSize:20,lineHeight:26,fontWeight:'700',marginTop:12,color:COLORS.primary},label:{fontSize:16,lineHeight:23,fontWeight:'600',color:COLORS.text,marginBottom:8},body:{fontSize:16,lineHeight:24,color:COLORS.text,flexShrink:1},hint:{fontSize:14,lineHeight:21,color:'#625b5d'},group:{borderTopWidth:1,borderColor:'#e6dfe0',paddingTop:16,gap:8},choice:{flexDirection:'row',gap:12,padding:12,minHeight:48,borderWidth:1,borderColor:'#d8cfd0',borderRadius:10},radio:{fontSize:22,color:'#625b5d'},active:{backgroundColor:'#f8eeef',borderColor:COLORS.primary},scores:{flexDirection:'row',gap:8,flexWrap:'wrap'},score:{minWidth:44,minHeight:48,borderWidth:1,borderColor:'#d8cfd0',borderRadius:8,alignItems:'center',justifyContent:'center',flex:1},picker:{borderWidth:1,borderColor:'#d8cfd0',borderRadius:10},error:{fontSize:14,lineHeight:21,color:'#ad2132',marginBottom:8},practice:{fontSize:16,lineHeight:24,color:COLORS.primary,padding:16,backgroundColor:'#f8eeef',borderRadius:10}});
