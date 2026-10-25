import { router,usePathname } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { useState } from 'react';
import { Image,StyleSheet,Text,Pressable,View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import NotificationModal from '../notification/notification-modal';
import { useNotifications } from '../notification/use-notification';
import { TourTarget,useTutorial } from '../tutorial/tutorial';
import { useClientUI } from '../client/client-ui';
interface HeaderProps {title?:string;onNotificationPress?:()=>void;onBackPress?:()=>void;showBack?:boolean}
export default function AppHeader({title,onNotificationPress,onBackPress,showBack}:HeaderProps){
 const focused=useIsFocused();
 const path=usePathname(),insets=useSafeAreaInsets(),guide=useTutorial(),ui=useClientUI();
 const [visible,setVisible]=useState(false);const {unreadCount}=useNotifications();
 const label=title||(path.includes('/home')?'Queue Dashboard':path.includes('/queue')?'Transactions':path.includes('/profile')?(path.startsWith('/parent')?'Parent Profile':'Student Profile'):'UniQueue');
 return <View style={[s.container,{paddingTop:Math.max(insets.top,12)}]}>
 {showBack&&<Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBackPress||(()=>router.back())} style={s.icon}><Ionicons name="chevron-back" size={24} color={COLORS.primary}/></Pressable>}
 <View style={{flex:1,minWidth:0}}><TourTarget id="header"><View style={s.left}><Image source={require('../../assets/images/logo.png')} style={s.logo}/><Text numberOfLines={2} accessibilityRole="header" style={s.title}>{label}</Text></View></TourTarget></View>
 <TourTarget id="help"><Pressable accessibilityLabel="Open guided tutorial" accessibilityRole="button" onPress={()=>void guide.start()} onLongPress={()=>ui.confirm({title:'Restart guided tutorial?',message:'Start from the first step. No account or transaction data will change.',confirmLabel:'Restart guide',onConfirm:()=>void guide.start(true)})} style={s.icon}><Ionicons name="help-circle-outline" size={26} color={COLORS.primary}/></Pressable></TourTarget>
 <TourTarget id="bell"><Pressable accessibilityLabel={`Notifications, ${unreadCount} unread`} accessibilityRole="button" onPress={()=>{setVisible(true);onNotificationPress?.()}} style={s.icon}><Ionicons name="notifications-outline" size={24} color={COLORS.primary}/>{unreadCount>0&&<View style={s.badge}><Text style={s.badgeText}>{unreadCount>9?'9+':unreadCount}</Text></View>}</Pressable></TourTarget>
 <NotificationModal visible={visible||(focused&&guide.notificationStep)} onClose={()=>{setVisible(false);if(guide.notificationStep)guide.pause()}}/></View>;
}
const s=StyleSheet.create({container:{backgroundColor:'#fff',paddingHorizontal:12,paddingBottom:12,flexDirection:'row',alignItems:'center',gap:2,borderBottomWidth:1,borderColor:'#e8dfe1'},left:{flexDirection:'row',alignItems:'center',gap:8},logo:{width:32,height:32,resizeMode:'contain'},title:{fontSize:18,lineHeight:23,fontWeight:'700',color:COLORS.primary,flexShrink:1},icon:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:10},badge:{position:'absolute',right:0,top:0,minWidth:18,height:18,borderRadius:9,paddingHorizontal:3,backgroundColor:COLORS.danger,alignItems:'center',justifyContent:'center'},badgeText:{color:'#fff',fontSize:11,fontWeight:'700'}});
