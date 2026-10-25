/** Isolated native practice. No API imports or persistence of fixture changes. */
import { useEffect,useState } from 'react';
import { View,Text,StyleSheet,Pressable } from 'react-native';
import { router,useLocalSearchParams } from 'expo-router';
import { TourTarget,TutorialScrollView,useTutorial } from '@/components/tutorial/tutorial';
import QueueTypeStep from '@/components/queue-step/queue-type-step';
import ServiceItemStep from '@/components/queue-step/service-item-step';
import RequirementStep from '@/components/queue-step/requirement-step';
import ReviewStep from '@/components/queue-step/review-step';
import QueueDetailsCard from '@/components/queue/queue-details-card';
import QueueServiceItemsList from '@/components/queue/queue-service-items-list';
import CSMForm from '@/components/feedback/csm-form';
import { AcademicMap } from '@/components/queue-step/academic-step';
import { ChoiceMap } from '@/components/queue-step/choice-step';
import CustomButton from '@/components/ui/custom-button';
import { COLORS } from '@/constants/theme';
const items=[{id:1,name:'Document Request (example)',category:'Documents',requirements:['School ID (example)','Completed request form (example)'],use_academic_period:true,has_choices:true,choices:[{id:1,label:'Regular copy'},{id:2,label:'Certified copy'}]}];
export default function ClientPractice(){
 const params=useLocalSearchParams<{phase?:string}>(),guide=useTutorial();
 const [phase,setPhase]=useState('type');useEffect(()=>setPhase(params.phase||'type'),[params.phase]);
 const [queueType,setQueueType]=useState<'walkin'|'appointment'>('walkin'),[ids,setIds]=useState([1]),[quantities,setQuantities]=useState<Record<number,number>>({1:2});
 const [academic,setAcademic]=useState<AcademicMap>({1:[{period:'First Semester',school_year:'2025-2026'},{period:'First Semester',school_year:'2025-2026'}]});
 const [choices,setChoices]=useState<ChoiceMap>({1:{choice_id:1,choice_label:'Regular copy'}}),[checked,setChecked]=useState<string[]>([]),[slip,setSlip]=useState(false),[priority,setPriority]=useState(false),[reason,setReason]=useState('');
 const [expanded,setExpanded]=useState(false),[tab,setTab]=useState('Serving');
 // Restore the sample service when the next teaching target needs it.
 useEffect(()=>{if(guide.visible&&['quantity-1','academic-1','requirements','review'].includes(guide.step?.target||''))setIds(current=>current.length?current:[1]);},[guide.index,guide.visible,guide.step?.target]);
 const ticket={queue_number:'R-EXAMPLE',office_name:'Registrar (example)',status:'waiting',type:'walkin',people_ahead:3,joined_at:'2026-10-01T09:00:00+08:00',window_name:'Window 1 (example)'};
 return <View style={{flex:1,backgroundColor:COLORS.background}}><View style={s.header}><Text style={s.title}>Queue practice</Text><Pressable accessibilityRole="button" accessibilityLabel="Return to guide" onPress={guide.show} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontWeight:'700',fontSize:14,color:'#fff'}}>Guide ?</Text></Pressable></View>
 <TutorialScrollView contentContainerStyle={{padding:16,paddingBottom:180}} keyboardShouldPersistTaps="handled"><Text style={s.banner}>Example data · Nothing on this screen can create a ticket, payment, CSM response or profile change.</Text>
 <TourTarget id="practice">
 {phase==='type'&&<TourTarget id="queue-type"><QueueTypeStep queueType={queueType} setQueueType={setQueueType} walkinEnabled appointmentEnabled onNext={guide.show}/></TourTarget>}
 {['services','academic'].includes(phase)&&<ServiceItemStep service_items={items} selectedServiceItems={ids} setSelectedServiceItems={setIds} quantities={quantities} setQuantities={setQuantities} priority={priority} setPriority={setPriority} priorityReason={reason} setPriorityReason={setReason} priorityEnabled itemChoices={choices} setItemChoices={setChoices} academic={academic} setAcademic={setAcademic} periods={[{id:1,label:'First Semester'},{id:2,label:'Second Semester'}]} schoolYears={[{id:1,school_year:'2025-2026'},{id:2,school_year:'2026-2027'}]} onNext={guide.show} onBack={guide.show}/>}
 {phase==='requirements'&&<TourTarget id="requirements"><RequirementStep service_items={items} selectedServiceItems={ids} checkedRequirements={checked} setCheckedRequirements={setChecked} queueType={queueType} appointmentSlipConfirmed={slip} setAppointmentSlipConfirmed={setSlip} itemChoices={choices} onNext={guide.show} onBack={guide.show}/></TourTarget>}
 {phase==='review'&&<TourTarget id="review"><ReviewStep queueType={queueType} appointmentSlipConfirmed={slip} service_items={items} selectedServiceItems={ids} quantities={quantities} priority={priority} priorityReason={reason} academic={academic} itemChoices={choices} practice onSubmit={()=>{}} onBack={guide.show}/></TourTarget>}
 {phase==='ticket'&&<><TourTarget id="ticket"><QueueDetailsCard queue={ticket}/></TourTarget><TourTarget id="ticket-services"><QueueServiceItemsList service_items={[{name:'Document Request (example) · Regular copy',quantity:2}]}/></TourTarget><TourTarget id="ticket-eta"><Text style={s.banner}>Copy 1: First Semester / 2025-2026{ '\n'}Copy 2: First Semester / 2025-2026{ '\n'}Example ETA: about 15 minutes. Real times can change.</Text></TourTarget></>}
 {phase==='monitor'&&<><Text style={s.subtitle}>Office live monitor (example)</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:12}}>{['Serving','Waiting','Completed'].map(t=><CustomButton key={t} title={t} outlined={tab!==t} onPress={()=>setTab(t)}/>)}</View><QueueDetailsCard queue={{...ticket,status:tab==='Serving'?'in_progress':tab==='Waiting'?'waiting':'completed'}}/><CustomButton title={expanded?'Hide details':'Expand details'} outlined onPress={()=>setExpanded(v=>!v)}/>{expanded&&<QueueServiceItemsList service_items={[{name:'Document Request (example)',quantity:2}]}/>}<Text style={s.banner}>Practice is silent. No notification permission or sound is triggered.</Text></>}
 {phase==='csm'&&<CSMForm office="Registrar (example)" service="Document Request (example)" practice onSubmit={()=>{}}/>}
 </TourTarget><View style={{marginTop:20,gap:12}}><CustomButton title="Back to guide" onPress={guide.show}/><CustomButton title="Exit practice" outlined onPress={async()=>{const storage=(await import('@react-native-async-storage/async-storage')).default;const role=await storage.getItem('role');router.replace(role==='parent'?'/parent/home':'/student/home')}}/></View></TutorialScrollView></View>;
}
const s=StyleSheet.create({header:{paddingTop:44,padding:16,backgroundColor:COLORS.primary,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:22,fontWeight:'700',color:'#fff'},subtitle:{fontSize:20,fontWeight:'700',color:COLORS.primary},banner:{fontSize:14,lineHeight:21,color:COLORS.primary,backgroundColor:'#f8eeef',padding:16,borderRadius:10,marginBottom:16}});
