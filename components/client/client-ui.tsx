import React,{createContext,useContext,useRef,useState,useEffect} from 'react';
import type { AlertButton } from 'react-native';
import { Modal,Pressable,Text,View,StyleSheet,ScrollView } from 'react-native';
import CustomButton from '../ui/custom-button';
import { COLORS } from '@/constants/theme';
type Dialog={title:string;message:string;confirmLabel?:string;danger?:boolean;success?:boolean;onConfirm?:()=>void;cancel?:boolean;cancelLabel?:string;onCancel?:()=>void;extra?:AlertButton[]};
type UI={notify:(message:string,kind?:'success'|'error')=>void;confirm:(dialog:Dialog)=>void;success:(dialog:Dialog)=>void};
let showAlert:((title:string,message?:string,buttons?:AlertButton[])=>void)|null=null;
/** Shared visual policy for client confirmations and form notices. */
export function clientAlert(title:string,message?:string,buttons?:AlertButton[],_options?:unknown){showAlert?.(title,message,buttons)}
const Context=createContext<UI>({notify:()=>{},confirm:()=>{},success:()=>{}});
export const useClientUI=()=>useContext(Context);
export function ClientUIProvider({children}:{children:React.ReactNode}){
 const [dialog,setDialog]=useState<Dialog|null>(null),[toast,setToast]=useState<{message:string;kind:string}|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
 useEffect(()=>{showAlert=(title,message,buttons)=>{const list=buttons?.length?buttons:[{text:'OK'}];const cancel=list.find(b=>b.style==='cancel');const actions=list.filter(b=>b!==cancel);const primary=actions[actions.length-1]||cancel;setDialog({title,message:message||'',confirmLabel:primary?.text||'OK',onConfirm:primary?.onPress,cancel:!!cancel&&primary!==cancel,cancelLabel:cancel?.text,onCancel:cancel?.onPress,danger:primary?.style==='destructive',success:/success|created|updated|saved|sent/i.test(title),extra:actions.slice(0,-1)})};return()=>{showAlert=null}},[]);
 const notify=(message:string,kind='success')=>{if(timer.current)clearTimeout(timer.current);setToast({message,kind});timer.current=setTimeout(()=>setToast(null),5000)};
 return <Context.Provider value={{notify,confirm:d=>setDialog({...d,cancel:true}),success:d=>setDialog({...d,success:true})}}>{children}
 {toast&&<View style={[s.toast,{backgroundColor:toast.kind==='error'?'#8a2e35':'#196b32'}]} accessibilityLiveRegion="assertive"><Text style={s.toastText}>{toast.message}</Text><Pressable accessibilityLabel="Dismiss notification" accessibilityRole="button" onPress={()=>setToast(null)} style={s.close}><Text style={s.toastText}>×</Text></Pressable></View>}
 <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={()=>setDialog(null)}><View style={s.overlay}><View style={s.card} accessibilityViewIsModal><ScrollView contentContainerStyle={{padding:24,gap:16}}>
 {dialog?.success&&<View style={s.check}><Text style={{fontSize:30,color:'#196b32'}}>✓</Text></View>}
 <Text accessibilityRole="header" style={s.title}>{dialog?.title}</Text><Text style={s.message}>{dialog?.message}</Text>
 {dialog?.extra?.map((button,i)=><CustomButton key={i} title={button.text||'Continue'} outlined onPress={()=>{setDialog(null);button.onPress?.()}}/>)}
 <CustomButton title={dialog?.confirmLabel||'Continue'} onPress={()=>{const fn=dialog?.onConfirm;setDialog(null);fn?.()}}/>
 {dialog?.cancel&&<CustomButton title={dialog.cancelLabel||"Cancel"} outlined onPress={()=>{const fn=dialog.onCancel;setDialog(null);fn?.()}}/>}
 </ScrollView></View></View></Modal></Context.Provider>;
}
const s=StyleSheet.create({overlay:{flex:1,backgroundColor:COLORS.overlay,justifyContent:'center',padding:20},card:{backgroundColor:'#fff',borderRadius:16,maxHeight:'85%',width:'100%',maxWidth:440,alignSelf:'center'},title:{fontSize:22,lineHeight:28,fontWeight:'700',color:COLORS.text,textAlign:'center'},message:{fontSize:16,lineHeight:24,color:'#625b5d',textAlign:'center'},check:{width:64,height:64,alignSelf:'center',alignItems:'center',justifyContent:'center',borderRadius:32,backgroundColor:'#e5f3e8'},toast:{position:'absolute',bottom:96,left:16,right:16,zIndex:1000,borderRadius:12,padding:16,flexDirection:'row',alignItems:'center'},toastText:{color:'#fff',fontSize:16,lineHeight:22,flexShrink:1},close:{marginLeft:'auto',minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}});
