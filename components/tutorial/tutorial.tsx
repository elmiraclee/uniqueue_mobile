import React, { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BackHandler, LayoutChangeEvent, Platform, Pressable, ScrollView, ScrollViewProps, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useIsFocused, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clientFetch, getSessionToken } from '@/utils/client-fetch';
import { API_URL } from '@/constants/backend';
import { COLORS } from '@/constants/theme';
import { clientTourSteps, TourStep } from './steps';
type Rect = { x: number; y: number; width: number; height: number };
type Target = { view: View; scroll: {outer:React.RefObject<ScrollView|null>;inner:React.RefObject<View|null>} | null };
type Progress = { step: number; status: 'active' | 'skipped' | 'completed' };
type Guide = {
 register: (key: string, target: Target | null) => void;
 start: (restart?: boolean) => Promise<void>; show: () => void; pause: () => void;
 active: boolean; visible: boolean; step: TourStep | null; notificationStep: boolean;
 index: number; count: number; role: string; rect: Rect | null;
 bounds: Rect; setBounds: (r: Rect) => void; next: () => void; back: () => void; skip: () => void;
};
const noop=()=>{};
const Context=createContext<Guide>({register:noop,start:async()=>{},show:noop,pause:noop,active:false,visible:false,step:null,notificationStep:false,index:0,count:1,role:'student',rect:null,bounds:{x:0,y:0,width:0,height:0},setBounds:noop,next:noop,back:noop,skip:noop});
const ScrollContext=createContext<{outer:React.RefObject<ScrollView|null>;inner:React.RefObject<View|null>}|null>(null);
export const useTutorial=()=>useContext(Context);
export const TutorialScrollView=forwardRef<ScrollView,ScrollViewProps>(function TutorialScrollView(props,external){
 const ref=useRef<ScrollView>(null),inner=useRef<View>(null!);
 const scroll=React.useMemo(()=>({outer:ref,inner}),[]);
 return <ScrollContext.Provider value={scroll}><ScrollView {...props} {...(Platform.OS==='web'?{}:{innerViewRef:inner})} ref={node=>{ref.current=node;if(typeof external==='function')external(node);else if(external)external.current=node}}/></ScrollContext.Provider>;
});
export function TourTarget({id,children}:{id:string;children:React.ReactNode}){
 const focused=useIsFocused();
 const ref=useRef<View>(null),scroll=useContext(ScrollContext),{register}=useTutorial(),path=usePathname();
 const update=useCallback(()=>{if(focused&&ref.current)register(path+':'+id,{view:ref.current,scroll})},[id,path,register,scroll,focused]);
 useEffect(()=>{if(focused)update();return()=>{if(focused)register(path+':'+id,null)}},[update,id,path,register,focused]);
 return <View ref={ref} onLayout={update} collapsable={false}>{children}</View>;
}
/** The navigator/sheet and coach are FLEX SIBLINGS. The coach never covers content. */
export function TutorialStage({children,modal=false}:{children:React.ReactNode;modal?:boolean}){
 const guide=useTutorial(),ref=useRef<View>(null);
 const active=guide.visible&&guide.notificationStep===modal;
 const layout=useCallback((_event?:LayoutChangeEvent)=>{if(active)ref.current?.measureInWindow((x,y,width,height)=>guide.setBounds({x,y,width,height}))},[active,guide.setBounds]);
 useEffect(()=>{const timers=[50,350,650].map(delay=>setTimeout(layout,delay));return()=>timers.forEach(clearTimeout)},[layout]);
 const r=guide.rect,b=guide.bounds;
 const x=r?Math.max(0,r.x-b.x):0,y=r?Math.max(0,r.y-b.y):0;
 const w=r?Math.min(r.width,Math.max(0,b.width-x)):0,h=r?Math.min(r.height,Math.max(0,b.height-y)):0;
 // Only safe preview/monitor/notice interactions pass through during a guide.
 const interactive=guide.step?.screen==='client-practice'||guide.step?.screen.endsWith('/live-monitor')||modal;
 return <View testID={modal?"tutorial-modal-stage":"tutorial-stage"} ref={ref} collapsable={false} onLayout={layout} style={s.stage}>{children}
 {active&&<View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
 {!interactive&&<View style={StyleSheet.absoluteFill} accessibilityLabel="Use the guide controls to continue"/>}
 <View pointerEvents="none" style={StyleSheet.absoluteFill}>
 {r&&w>0&&h>0?<><View style={[s.dim,{top:0,left:0,right:0,height:y}]}/><View style={[s.dim,{top:y,left:0,width:x,height:h}]}/><View style={[s.dim,{top:y,left:x+w,right:0,height:h}]}/><View style={[s.dim,{top:y+h,left:0,right:0,bottom:0}]}/><View testID="tutorial-highlight" style={[s.outline,{left:Math.max(2,x-2),top:Math.max(2,y-2),width:Math.min(b.width-4,w+4),height:Math.min(b.height-4,h+4)}]}/></>:<View style={[s.dim,StyleSheet.absoluteFill]}/>}
 </View></View>}
 </View>;
}
export function TutorialCoach({modal=false}:{modal?:boolean}){
 const g=useTutorial(),insets=useSafeAreaInsets(),size=useWindowDimensions(),[details,setDetails]=useState(false);
 useEffect(()=>setDetails(false),[g.index,g.visible]);
 if(!g.visible||g.notificationStep!==modal||!g.step)return null;
 const summary=g.step.body.split(/(?<=[.!?])\s+/).slice(0,2).join(' ');
 return <View testID="tutorial-coach" style={[s.coach,{paddingBottom:Math.max(insets.bottom,8),maxHeight:size.height*(size.height<600?.48:.40)}]}>
 <View style={s.metaRow}><Text style={s.meta}>{g.role==='parent'?'Parent':'Student'} guide · {g.index+1}/{g.count}</Text><Pressable onPress={g.skip} accessibilityRole="button" style={s.smallButton}><Text style={s.link}>Skip</Text></Pressable></View>
 <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:g.count,now:g.index+1}} style={s.track}><View style={[s.progress,{width:`${(g.index+1)/g.count*100}%`}]}/></View>
 <ScrollView style={{flexShrink:1}} contentContainerStyle={{paddingVertical:8,gap:6}}>
 <Text accessibilityRole="header" style={s.title}>{g.step.title}</Text><Text style={s.body}>{details?g.step.body:summary}</Text>

 {g.step.body!==summary&&<Pressable onPress={()=>setDetails(v=>!v)} accessibilityRole="button" style={s.smallButton}><Text style={s.link}>{details?'Less detail':'More details'}</Text></Pressable>}
 </ScrollView>
 <View style={s.actions}><Pressable disabled={!g.index} onPress={g.back} accessibilityRole="button" style={[s.button,s.secondary,!g.index&&{opacity:.4}]}><Text style={s.link}>Back</Text></Pressable><Pressable onPress={g.pause} accessibilityRole="button" style={[s.button,s.secondary]}><Text style={s.link}>{g.step.phase?'Try it':'Pause'}</Text></Pressable><Pressable onPress={g.next} accessibilityRole="button" style={[s.button,s.primary]}><Text style={s.primaryText}>{g.index===g.count-1?'Finish':'Next →'}</Text></Pressable></View>
 </View>;
}
export function TutorialProvider({children}:{children:React.ReactNode}){
 const path=usePathname(),size=useWindowDimensions(),insets=useSafeAreaInsets();
 const targets=useRef(new Map<string,Target>()),[registry,setRegistry]=useState(0),[role,setRole]=useState<'student'|'parent'>('student'),[key,setKey]=useState(''),[progress,setProgress]=useState<Progress|null>(null),[visible,setVisible]=useState(false),[rect,setRect]=useState<Rect|null>(null),[bounds,setBoundsState]=useState<Rect>({x:0,y:0,width:0,height:0});
 const steps=clientTourSteps(role),index=Math.min(progress?.step||0,steps.length-1),step=steps[index];
 const register=useCallback((id:string,t:Target|null)=>{if(t)targets.current.set(id,t);else targets.current.delete(id);setRegistry(v=>v+1)},[]);
 const setBounds=useCallback((r:Rect)=>setBoundsState(old=>Object.keys(r).every(k=>old[k as keyof Rect]===r[k as keyof Rect])?old:r),[]);
 const syncQueue=useRef<Promise<unknown>>(Promise.resolve());
 const sync=useCallback((p:Progress)=>{const captured=getSessionToken();syncQueue.current=syncQueue.current.catch(()=>{}).then(async()=>{const token=await captured;if(token&&await getSessionToken()===token)return clientFetch(API_URL+'/mobile_tour.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)})}).catch(()=>{})},[]);
 const save=async(p:Progress)=>{setProgress(p);if(key)await AsyncStorage.setItem(key,JSON.stringify(p));sync(p)};
 const start=useCallback(async(restart=false)=>{try{
 const [raw,r,token]=await Promise.all([AsyncStorage.getItem('user'),AsyncStorage.getItem('role'),getSessionToken()]);if(!raw||!token||!['student','parent'].includes(r||''))return;
 const user=JSON.parse(raw),k=`client-tour:native:2:${r}:${user.id}`;setRole(r as 'student'|'parent');setKey(k);
 let p:Progress={step:0,status:'active'};const stored=await AsyncStorage.getItem(k);
 if(!restart&&stored){const old=JSON.parse(stored);if(old.status==='active')p=old;}
 if(!restart&&!stored){try{const data=await(await clientFetch(API_URL+'/mobile_tour.php')).json();if(data.success&&data.progress?.status==='active')p={step:Number(data.progress.step),status:'active'}}catch{}}
 p.step=Math.max(0,Math.min(clientTourSteps(r as 'student'|'parent').length-1,Number(p.step)||0));setProgress(p);await AsyncStorage.setItem(k,JSON.stringify(p));sync(p);setVisible(true);
 }catch{/* Do not open a guide for an invalid cached account. */}},[sync]);
 useEffect(()=>{let alive=true;void(async()=>{try{const [raw,r]=await Promise.all([AsyncStorage.getItem('user'),AsyncStorage.getItem('role')]);const current=raw?`client-tour:native:2:${r}:${JSON.parse(raw).id}`:'';if(alive&&key&&current!==key){setVisible(false);setProgress(null);setKey('')}}catch{if(alive)setVisible(false)}})();return()=>{alive=false}},[path,key]);
 useEffect(()=>{if(!path.endsWith('/home'))return;let alive=true;void(async()=>{const [raw,r,flag]=await Promise.all([AsyncStorage.getItem('user'),AsyncStorage.getItem('role'),AsyncStorage.getItem('client_tour_new')]);if(!alive||!raw)return;try{if(flag===`${r}:${JSON.parse(raw).id}`){await AsyncStorage.removeItem('client_tour_new');await start(true)}}catch{}})();return()=>{alive=false}},[path,start]);
 useEffect(()=>{if(!visible||!progress)return;const destination='/'+step.screen;if(path!==destination){setRect(null);router.replace({pathname:destination as any,params:step.phase?{phase:step.phase}:{}})}else if(step.phase)router.setParams({phase:step.phase})},[visible,index,role,path,step.screen,step.phase]);
 useEffect(()=>{if(!visible)return;setRect(null);let cancelled=false;const timers:ReturnType<typeof setTimeout>[]=[];const targetKey=path+':'+step.target;
 const measure=()=>{if(cancelled)return;const t=targets.current.get(targetKey);if(!t)return;t.view.measureInWindow((x,y,width,height)=>{if(cancelled||targets.current.get(targetKey)!==t)return;
 const top=Math.max(y,bounds.y),bottom=Math.min(y+height,bounds.y+bounds.height);if(width>0&&bottom>top)setRect({x:Math.max(x,bounds.x),y:top,width:Math.min(width,bounds.width),height:bottom-top});})};
 timers.push(setTimeout(()=>{if(cancelled)return;const t=targets.current.get(targetKey),scroll=t?.scroll?.outer.current,content=t?.scroll?.inner.current||(Platform.OS==='web'?(scroll as (ScrollView & {getInnerViewRef?:()=>View|null})|undefined)?.getInnerViewRef?.():null);
 if(t&&scroll&&content)t.view.measureLayout(content,(_x,y)=>{if(cancelled)return;scroll.scrollTo({y:Math.max(0,y-12),animated:false});timers.push(setTimeout(measure,80))},measure);
 measure();timers.push(setTimeout(measure,350));},100));
 return()=>{cancelled=true;timers.forEach(clearTimeout)};
 },[visible,path,index,role,registry,bounds,step.target,size.width,size.height]);
 const pause=useCallback(()=>setVisible(false),[]);
 useEffect(()=>{if(!visible)return;const sub=BackHandler.addEventListener('hardwareBackPress',()=>{pause();return true});return()=>sub.remove()},[visible,pause]);
 const close=async(status:'skipped'|'completed')=>{setVisible(false);await save({step:index,status});if(path==='/client-practice')router.replace(`/${role}/home`)};
 const notificationStep=visible&&step.target==='notice-list';
 const guide:Guide={register,start,show:()=>{if(progress?.status==='active')setVisible(true);else void start()},pause,active:progress?.status==='active',visible,step,index,count:steps.length,role,rect,bounds,setBounds,notificationStep,next:()=>{if(index===steps.length-1)void close('completed');else void save({step:index+1,status:'active'})},back:()=>{if(index)void save({step:index-1,status:'active'})},skip:()=>void close('skipped')};
 return <Context.Provider value={guide}><View style={s.root}><TutorialStage>{children}</TutorialStage><TutorialCoach/>
 {!visible&&progress?.status==='active'&&<Pressable accessibilityRole="button" onPress={()=>setVisible(true)} style={[s.resume,{bottom:insets.bottom+80}]}><Text style={s.primaryText}>Resume guide</Text></Pressable>}
 </View></Context.Provider>;
}
const s=StyleSheet.create({root:{flex:1},stage:{flex:1,minHeight:0,overflow:'hidden'},dim:{position:'absolute',backgroundColor:'rgba(30,14,16,.48)'},outline:{position:'absolute',borderWidth:3,borderColor:'#d899a4',borderRadius:10},coach:{flexShrink:0,paddingHorizontal:16,paddingTop:2,backgroundColor:'#fff',borderTopWidth:2,borderColor:'#650610'},metaRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},meta:{fontSize:14,color:'#625b5d'},smallButton:{minHeight:44,justifyContent:'center',paddingHorizontal:8},link:{fontSize:14,fontWeight:'700',color:COLORS.primary},track:{height:3,backgroundColor:'#eee4e6'},progress:{height:3,backgroundColor:COLORS.primary},title:{fontSize:18,lineHeight:23,fontWeight:'700',color:'#3e1b23'},body:{fontSize:16,lineHeight:23,color:'#403a3c'},hint:{fontSize:14,lineHeight:20,color:'#625b5d'},actions:{flexDirection:'row',gap:8,paddingVertical:4},button:{flex:1,minHeight:44,borderRadius:8,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:COLORS.primary},primary:{backgroundColor:COLORS.primary},secondary:{backgroundColor:'#fff'},primaryText:{fontSize:14,fontWeight:'700',color:'#fff'},resume:{position:'absolute',right:16,padding:14,backgroundColor:COLORS.primary,borderRadius:10,zIndex:900,minHeight:48}});
