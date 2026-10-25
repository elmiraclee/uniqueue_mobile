import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clientAlert } from '@/components/client/client-ui';
import LinkedAccounts from '@/components/client/linked-accounts';
import AppHeader from '@/components/layout/app-header';
import ChangePasswordModal from '@/components/queue/change-password-modal';
import CustomButton from '@/components/ui/custom-button';
import { TourTarget, TutorialScrollView } from '@/components/tutorial/tutorial';
import { API, ASSET_BASE_URL } from '@/constants/backend';
import { COLORS } from '@/constants/theme';
import { gradeChoices, SCHOOL_LEVELS, SchoolLevel, useGradeOptions } from '@/hooks/use-grade-options';
import { logoutClient } from '@/utils/client-fetch';
import { fetchJsonOrNull } from '@/utils/api';
type Form={first_name:string;last_name:string;email:string;school_level:SchoolLevel;grade_year:string;college_id:string;program_id:string};
const empty:Form={first_name:'',last_name:'',email:'',school_level:'College',grade_year:'',college_id:'',program_id:''};
export default function Profile(){
 const size=useWindowDimensions();
 const [photoFailed,setPhotoFailed]=useState(false);
 const [student,setStudent]=useState<any>(null),[form,setForm]=useState<Form>(empty),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[error,setError]=useState('');
 const [photoVisible,setPhotoVisible]=useState(false),[passwordVisible,setPasswordVisible]=useState(false),[colleges,setColleges]=useState<any[]>([]),[programs,setPrograms]=useState<any[]>([]);
 const catalog=useGradeOptions();
 useEffect(()=>setPhotoFailed(false),[student?.picture,student?.google_picture]);
 const fill=useCallback((p:any)=>{setForm({first_name:p.first_name||'',last_name:p.last_name||'',email:p.email||'',school_level:p.school_level||'College',grade_year:p.grade_year||(p.year_level?`${['','1st','2nd','3rd','4th','5th','6th'][Number(p.year_level)]||p.year_level} Year`:''),college_id:p.college_id?String(p.college_id):'',program_id:p.program_id?String(p.program_id):''})},[]);
 const load=useCallback(async()=>{try{setError('');const raw=await AsyncStorage.getItem('user');if(!raw)return;const id=JSON.parse(raw).id;
 const [data,cs]=await Promise.all([fetchJsonOrNull(`${API.getStudentProfile}?student_id=${id}`),fetchJsonOrNull(API.getColleges)]);
 if(!data?.success||!data.student)throw new Error('Could not load profile. Pull down to retry.');setStudent(data.student);fill(data.student);setColleges(Array.isArray(cs)?cs:[]);
 }catch(e){setError(e instanceof Error?e.message:'Could not load profile.')}finally{setLoading(false);setRefreshing(false)}},[fill]);
 useFocusEffect(useCallback(()=>{void load()},[load]));
 useEffect(()=>{let alive=true;if(!form.college_id){setPrograms([]);return;}void fetchJsonOrNull(`${API.getPrograms}?college_id=${form.college_id}`).then(data=>{if(alive)setPrograms(Array.isArray(data)?data:[])});return()=>{alive=false}},[form.college_id]);
 const choices=gradeChoices(catalog.grades,form.school_level,student?{school:student.school_level||'College',value:student.grade_year||form.grade_year}:undefined);
 const collegeOptions=colleges.map(c=>({label:c.college_name,value:String(c.college_id)}));
 const programOptions=programs.map(p=>({label:p.program_name,value:String(p.program_id)}));
 if(student?.college_id&&!collegeOptions.some(c=>c.value===String(student.college_id)))collegeOptions.push({label:(student.college_name||'Current college')+' (current)',value:String(student.college_id)});
 if(String(student?.college_id)===form.college_id&&student?.program_id&&!programOptions.some(p=>p.value===String(student.program_id)))programOptions.push({label:(student.program_name||'Current program')+' (current)',value:String(student.program_id)});
 const field=(key:'first_name'|'last_name'|'email',label:string)=><View><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} editable={editing&&!saving} value={form[key]} onChangeText={v=>setForm(p=>({...p,[key]:v}))} maxLength={key==='email'?255:50} keyboardType={key==='email'?'email-address':'default'} autoCapitalize={key==='email'?'none':'words'} style={[s.input,!editing&&s.readOnly]}/></View>;
 const picker=(label:string,value:string,items:{value:string;label:string}[],change:(v:string)=>void)=><View><Text style={s.label}>{label}</Text>{editing?<View style={s.picker}><Picker accessibilityLabel={label} selectedValue={value} enabled={!saving} onValueChange={v=>change(String(v))}><Picker.Item label={`Select ${label.toLowerCase()}`} value=""/>{items.map(i=><Picker.Item key={i.value} label={i.label} value={i.value}/>)}</Picker></View>:<Text style={s.readValue}>{items.find(i=>i.value===value)?.label||value||'Not set'}</Text>}</View>;
 const save=async()=>{if(!student||saving)return;if(!form.first_name.trim()||!form.last_name.trim()||!/^\S+@\S+\.\S+$/.test(form.email))return clientAlert('Check profile','Enter valid names and email.');
 if(catalog.loading||catalog.error||!choices.some(g=>g.value===form.grade_year))return clientAlert('Academic details','Load and select a valid grade / year.');
 if(form.school_level==='College'&&(!form.college_id||!form.program_id))return clientAlert('Academic details','Select College and Program.');
 setSaving(true);try{const data=await fetchJsonOrNull(API.updateProfile,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,student_id:student.id,college_id:form.school_level==='College'?Number(form.college_id):null,program_id:form.school_level==='College'?Number(form.program_id):null,grade_version:student.grade_version})});
 if(!data?.success)throw new Error(data?.message||'Could not save profile.');setStudent(data.student);fill(data.student);const raw=await AsyncStorage.getItem('user');await AsyncStorage.setItem('user',JSON.stringify({...JSON.parse(raw||'{}'),...data.student}));setEditing(false);clientAlert('Saved','Your profile was updated.');
 }catch(e){clientAlert('Unable to save',e instanceof Error?e.message:'Please retry.')}finally{setSaving(false)}};
 const pickPhoto=async()=>{setPhotoVisible(false);const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)return clientAlert('Gallery permission','Allow gallery access to choose a photo.');
 const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.8});if(result.canceled)return;
 setUploading(true);try{const body=new FormData();body.append('student_id',String(student.id));body.append('picture',{uri:result.assets[0].uri,type:'image/jpeg',name:'profile.jpg'} as any);const data=await fetchJsonOrNull(API.uploadProfilePicture,{method:'POST',body});if(!data?.success)throw new Error(data?.message||'Photo could not upload.');await load();clientAlert('Saved','Profile photo updated.');}catch(e){clientAlert('Photo',e instanceof Error?e.message:'Please retry.')}finally{setUploading(false)}};
 const picture=student?.picture||student?.google_picture||'';const photo=picture?(picture.startsWith('http')?picture:`${ASSET_BASE_URL}/${picture}`):'';
 if(loading)return <View style={s.root}><AppHeader title="Student Profile"/><ActivityIndicator style={{margin:32}} color={COLORS.primary}/></View>;
 return <View style={s.root}><AppHeader title="Student Profile"/><TutorialScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();void catalog.reload()}}/>}>
 {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
 <TourTarget id="profile"><View style={s.card}><View style={s.row}><Pressable onPress={()=>setPhotoVisible(true)} disabled={!student||uploading} accessibilityRole="button" accessibilityLabel="View profile photo" style={s.avatar}>{photo&&!photoFailed?<Image source={{uri:photo}} onError={()=>setPhotoFailed(true)} style={s.avatarImage}/>:<Text style={s.initial}>{form.first_name[0]}{form.last_name[0]}</Text>}</Pressable><View style={{flex:1}}><Text style={s.title}>{form.first_name} {form.last_name}</Text><Text style={s.meta}>{student?.sr_code}</Text><Text style={s.meta}>{uploading?'Uploading photo…':'Tap photo to view or change'}</Text></View></View></View></TourTarget>
 <View style={s.card}><View style={s.row}><Text style={[s.section,{flex:1}]}>Personal details</Text>{!editing&&<CustomButton title="Edit" outlined onPress={()=>setEditing(true)} disabled={!student}/>}</View>{field('first_name','First name')}{field('last_name','Last name')}{field('email','Email')}</View>
 <TourTarget id="academic-details"><View style={s.card}><Text style={s.section}>Academic details</Text>
 {catalog.loading&&<Text style={s.meta}>Loading grade choices…</Text>}{!!catalog.error&&<><Text style={s.error}>{catalog.error}</Text><CustomButton title="Retry grade choices" outlined onPress={()=>void catalog.reload()}/></>}
 {picker('School level',form.school_level,SCHOOL_LEVELS,v=>setForm(p=>({...p,school_level:v as SchoolLevel,grade_year:'',...(v==='College'?{}:{college_id:'',program_id:''})})))}
 {picker('Grade / year',form.grade_year,choices.map(g=>({label:g.label+(g.active?'':' (current)'),value:g.value})),v=>setForm(p=>({...p,grade_year:v})))}
 {form.school_level==='College'&&<>{picker('Department / college',form.college_id,collegeOptions,v=>setForm(p=>({...p,college_id:v,program_id:''})))}{picker('Program',form.program_id,programOptions,v=>setForm(p=>({...p,program_id:v})))}</>}
 </View></TourTarget>
 {editing&&<View style={s.row}><View style={{flex:1}}><CustomButton title="Cancel" outlined disabled={saving} onPress={()=>{fill(student);setEditing(false)}}/></View><View style={{flex:1}}><CustomButton title="Save changes" loading={saving} disabled={catalog.loading||!!catalog.error} onPress={()=>void save()}/></View></View>}
 <TourTarget id="password"><CustomButton title="Change password" outlined onPress={()=>setPasswordVisible(true)}/></TourTarget>
 <TourTarget id="linked-accounts"><LinkedAccounts role="student"/></TourTarget>
 <CustomButton title="Sign out" outlined onPress={()=>clientAlert('Sign out','Sign out of this device?',[{text:'Cancel',style:'cancel'},{text:'Sign out',style:'destructive',onPress:()=>void logoutClient()}])}/>
 </TutorialScrollView>
 <ChangePasswordModal studentId={Number(student?.id||0)} visible={passwordVisible} onClose={()=>setPasswordVisible(false)}/>
 <Modal visible={photoVisible} transparent animationType="fade" onRequestClose={()=>setPhotoVisible(false)}><View style={s.photoBackdrop}><View style={s.photoCard}><Text style={s.section}>Profile photo</Text>{photo&&!photoFailed?<Image accessibilityLabel="Current profile photo" source={{uri:photo}} onError={()=>setPhotoFailed(true)} style={[s.photoPreview,{height:Math.min(260,size.height*.25)}]} resizeMode="contain"/>:<Text style={s.meta}>{photoFailed?'Photo could not load. You can choose a new one.':'No profile photo yet.'}</Text>}<CustomButton title="Change photo" onPress={()=>void pickPhoto()}/><CustomButton title="Close" outlined onPress={()=>setPhotoVisible(false)}/></View></View></Modal>
 </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:COLORS.background},content:{padding:16,gap:16,paddingBottom:32},card:{backgroundColor:'#fff',padding:16,borderWidth:1,borderColor:'#e6dfe0',borderRadius:12,gap:12},row:{flexDirection:'row',alignItems:'center',gap:12},title:{fontSize:22,lineHeight:28,fontWeight:'700',color:COLORS.primary},section:{fontSize:18,lineHeight:25,fontWeight:'700',color:COLORS.primary},label:{fontSize:16,lineHeight:24,fontWeight:'600',color:COLORS.text,marginBottom:6},input:{minHeight:48,fontSize:16,color:COLORS.text,borderWidth:1,borderColor:'#d8cfd0',padding:12,borderRadius:8},readOnly:{backgroundColor:'#f9f8f7'},readValue:{fontSize:16,lineHeight:24,color:COLORS.text,paddingVertical:8},picker:{borderWidth:1,borderColor:'#d8cfd0',borderRadius:8,minHeight:48},meta:{fontSize:14,lineHeight:21,color:'#625b5d'},error:{fontSize:14,lineHeight:21,color:'#ad2132'},avatar:{height:72,width:72,borderRadius:36,backgroundColor:'#f8eeef',alignItems:'center',justifyContent:'center',overflow:'hidden'},avatarImage:{height:72,width:72},initial:{fontSize:24,color:COLORS.primary,fontWeight:'700'},photoBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.65)',justifyContent:'center',padding:20},photoCard:{backgroundColor:'#fff',borderRadius:12,padding:16,gap:16},photoPreview:{height:260,width:'100%'}});
