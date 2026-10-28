import { Linking, Pressable, Text, View } from 'react-native';
import { LEGAL_URLS } from '@/constants/backend';
import { clientAlert } from '@/components/client/client-ui';
export function LegalLinks() {
  const open = async (url: string) => { try { await Linking.openURL(url); } catch { clientAlert('Policies', 'Unable to open this page. Please try again.'); } };
  return <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,paddingVertical:10}}>
    {(['terms','privacy'] as const).map(key=><Pressable key={key} accessibilityRole="link" onPress={()=>void open(LEGAL_URLS[key])} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:'#660810',textDecorationLine:'underline'}}>{key==='terms'?'Terms of Use':'Privacy Notice'}</Text></Pressable>)}
  </View>;
}
