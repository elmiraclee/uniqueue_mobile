import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import AppHeader from '@/components/layout/app-header';
import CustomInput from '@/components/ui/custom-input';
import CustomButton from '@/components/ui/custom-button';
import { TourTarget, TutorialScrollView } from '@/components/tutorial/tutorial';
import { useClientUI } from '@/components/client/client-ui';
import { gradeChoices, useGradeOptions } from '@/hooks/use-grade-options';
import { clientFetch } from '@/utils/client-fetch';
import { API_URL } from '@/constants/backend';
type Check={state:'valid'|'invalid'|'unavailable';message:string};
export default function AddChild(){
 const ui=useClientUI(),catalog=useGradeOptions(),[mode,setMode]=useState<'create'|'link'>('create'),[first,setFirst]=useState(''),[last,setLast]=useState(''),[sr,setSr]=useState(''),[grade,setGrade]=useState(''),[relation,setRelation]=useState('Parent/Guardian'),[check,setCheck]=useState<Check|null>(null),[checking,setChecking]=useState(false),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
 const sequence=useRef(0),body={mode,first_name:first.trim(),last_name:last.trim(),sr_code:sr.trim(),grade_year:grade,relationship:relation};
 const key=JSON.stringify(body),valid=/^[A-Za-zÑñ' -]{1,50}$/.test(body.first_name)&&/^[A-Za-zÑñ' -]{1,50}$/.test(body.last_name)&&/^\d{2}-\d{5}$/.test(body.sr_code)&&(mode==='link'||gradeChoices(catalog.grades,'Elementary').some(g=>g.value===grade));
 useEffect(()=>{const n=++sequence.current;setCheck(null);setChecking(valid);if(!valid)return;
 const abort=new AbortController();let deadline:ReturnType<typeof setTimeout>|undefined;
 const timer=setTimeout(async()=>{deadline=setTimeout(()=>abort.abort(),8000);try{
 const response=await clientFetch(API_URL+'/parent_check_child.php',{method:'POST',headers:{'Content-Type':'application/json'},body:key,signal:abort.signal});
 const data=await response.json();if(!response.ok||!data.success)throw new Error('Checker unavailable');
 if(sequence.current===n)setCheck({state:data.allowed?'valid':'invalid',message:data.message||'Check your details.'});
 }catch{if(sequence.current===n)setCheck({state:'unavailable',message:'Live check could not finish. You may submit for final server validation.'});}
 finally{if(deadline)clearTimeout(deadline);if(sequence.current===n)setChecking(false)}},500);
 return()=>{sequence.current++;clearTimeout(timer);if(deadline)clearTimeout(deadline);abort.abort()};
 },[key,valid,retry]);
 async function submit(){if(busy||checking||!valid||!check||check.state==='invalid')return;setBusy(true);
 try{const response=await clientFetch(API_URL+'/parent_add_child.php',{method:'POST',headers:{'Content-Type':'application/json'},body:key});const data=await response.json();if(data.success)ui.success({title:data.mode==='request'?'Link request sent':'Child linked',message:data.message||'Your children list has been updated.',confirmLabel:'Continue',onConfirm:()=>router.replace('/parent/home')});else{setCheck({state:'invalid',message:data.message||'Check the details and try again.'});ui.notify(data.message||'Could not save.','error')}}catch{ui.notify('Connection failed. Check Children before submitting again.','error')}finally{setBusy(false)}}
 const formatSR=(value:string)=>{const d=value.replace(/\D/g,'').slice(0,7);setSr(d.length>2?d.slice(0,2)+'-'+d.slice(2):d)};
 return <View style={s.root}><AppHeader title="Add / Link Child" showBack/><TutorialScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
 <Text style={s.title}>Add / Link Child</Text>
 <TourTarget id="child-mode"><View style={s.row}>{(['create','link'] as const).map(v=><Pressable key={v} disabled={busy} accessibilityRole="button" accessibilityState={{selected:mode===v}} onPress={()=>setMode(v)} style={[s.tab,mode===v&&s.selected]}><Text style={{color:mode===v?'white':'#650610',fontWeight:'700',fontSize:16}}>{v==='create'?'Add Child':'Link Existing'}</Text></Pressable>)}</View><Text style={s.copy}>{mode==='create'?'Create a parent-managed Elementary profile. Choose Link Existing if a profile already exists.':'Use the exact school-record name and SR Code. Elementary links immediately; JHS, SHS and College require student approval.'}</Text></TourTarget>
 <TourTarget id="child-form"><View style={{gap:12}}><Text style={s.label}>First name *</Text><CustomInput accessibilityLabel="First name" value={first} onChangeText={setFirst} editable={!busy} maxLength={50}/><Text style={s.label}>Last name *</Text><CustomInput accessibilityLabel="Last name" value={last} onChangeText={setLast} editable={!busy} maxLength={50}/><Text style={s.label}>SR Code *</Text><CustomInput accessibilityLabel="SR Code" value={sr} onChangeText={formatSR} editable={!busy} placeholder="YY-NNNNN" keyboardType="number-pad" maxLength={8}/></View></TourTarget>
 {mode==='create'&&<><Text style={s.label}>Elementary grade *</Text>{catalog.loading&&<Text style={s.copy}>Loading current grades…</Text>}{!!catalog.error&&<><Text style={s.error}>{catalog.error}</Text><CustomButton title="Retry grades" outlined onPress={()=>void catalog.reload()}/></>}<View style={s.picker}><Picker accessibilityLabel="Elementary grade" enabled={!busy&&!catalog.loading} selectedValue={grade} onValueChange={setGrade}><Picker.Item label="Select grade" value=""/>{gradeChoices(catalog.grades,'Elementary').map(g=><Picker.Item key={g.value} label={g.label} value={g.value}/>)}</Picker></View></>}
 <Text style={s.label}>Relationship</Text><View style={s.picker}><Picker accessibilityLabel="Relationship" enabled={!busy} selectedValue={relation} onValueChange={setRelation}>{['Parent/Guardian','Mother','Father','Guardian'].map(g=><Picker.Item key={g} label={g} value={g}/>)}</Picker></View>
 <Text accessibilityLiveRegion="polite" style={[s.copy,check?.state==='invalid'&&s.error]}>{checking?'Checking details…':check?.message||'Complete the required details to check.'}</Text>
 <Text style={s.copy}>Live matching does not create a profile/link or prove guardianship. Final submission always revalidates your details.</Text>
 {valid&&!checking&&<CustomButton title="Check again" outlined disabled={busy} onPress={()=>setRetry(v=>v+1)}/>}
 <CustomButton title={mode==='create'?'Add Child':'Submit link request'} disabled={busy||checking||!valid||!check||check.state==='invalid'} loading={busy} onPress={()=>void submit()}/>
 </TutorialScrollView></View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#f3eded'},content:{padding:16,paddingBottom:32,gap:14},title:{fontSize:24,lineHeight:30,fontWeight:'700',color:'#650610'},copy:{fontSize:16,lineHeight:24,color:'#555'},label:{fontSize:16,lineHeight:24,fontWeight:'600',color:'#444'},row:{flexDirection:'row',gap:12},tab:{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#650610',borderRadius:8},selected:{backgroundColor:'#650610'},picker:{backgroundColor:'white',borderRadius:8,borderWidth:1,borderColor:'#d8cccc'},error:{fontSize:14,lineHeight:21,color:'#ad2132'}});
