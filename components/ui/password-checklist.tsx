import { StyleSheet, Text, View } from 'react-native';
import { passwordChecks } from '@/utils/password';
export default function PasswordChecklist({password,confirm}:{password:string;confirm?:string}){
 const checks=passwordChecks(password),score=checks.filter(c=>c.ok).length;
 const label=!password?'Password requirements':score<3?'Weak':score<5?'Almost there':'Very strong';
 const color=score===5?'#196b32':score>=3?'#925200':'#aa2333';
 return <View style={s.wrap} accessibilityLiveRegion="polite">
 {!!password&&<><View style={s.track}><View style={{height:5,width:`${score*20}%`,backgroundColor:color,borderRadius:3}}/></View><Text style={[s.strength,{color}]}>{label}</Text></>}
 {!password&&<Text style={s.strength}>{label}</Text>}
 {checks.map(c=><Text key={c.label} style={[s.item,{color:c.ok?'#196b32':'#625b5d'}]}>{c.ok?'✓':'○'} {c.label}</Text>)}
 {!!confirm&&<Text style={[s.item,{marginTop:8,color:confirm===password?'#196b32':'#aa2333'}]}>{confirm===password?'✓ Passwords match.':'Passwords do not match.'}</Text>}
 </View>;
}
const s=StyleSheet.create({wrap:{marginBottom:16,gap:4},track:{height:5,borderRadius:3,backgroundColor:'#eee8e9',overflow:'hidden'},strength:{fontSize:14,fontWeight:'700',marginBottom:4},item:{fontSize:14,lineHeight:20}});
