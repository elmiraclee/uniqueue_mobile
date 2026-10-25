import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
export default function CustomInput({style,secureTextEntry,...props}: TextInputProps) {
 const [visible,setVisible]=useState(false);
 const flat=StyleSheet.flatten(style)||{}; const {marginBottom,...inputStyle}=flat;
 return <View style={{marginBottom:marginBottom??14}}><TextInput {...props} placeholderTextColor={COLORS.gray}
 style={[s.input,inputStyle,secureTextEntry&&{paddingRight:54}]} secureTextEntry={!!secureTextEntry&&!visible}
 autoCapitalize={secureTextEntry?'none':props.autoCapitalize} autoCorrect={secureTextEntry?false:props.autoCorrect}/>
 {secureTextEntry&&<Pressable accessibilityRole="button" accessibilityLabel={visible?'Hide password':'Show password'}
 accessibilityState={{selected:visible}} hitSlop={4} onPress={()=>setVisible(v=>!v)} style={s.eye}>
 <Ionicons name={visible?'eye-off-outline':'eye-outline'} size={22} color={COLORS.primary}/></Pressable>}</View>;
}
const s=StyleSheet.create({input:{minHeight:48,borderWidth:1,borderColor:'#cfc4c5',borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:16,color:COLORS.text,backgroundColor:'#fff'},eye:{position:'absolute',right:2,top:2,bottom:2,minWidth:46,alignItems:'center',justifyContent:'center',borderRadius:8}});
