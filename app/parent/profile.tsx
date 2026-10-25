import { clientAlert } from '@/components/client/client-ui';
import LinkedAccounts from '@/components/client/linked-accounts';
import { logoutClient } from '@/utils/client-fetch';
import { TourTarget, TutorialScrollView } from '@/components/tutorial/tutorial';
import CustomInput from '@/components/ui/custom-input';
/**
 * Parent profile — mobile version of web parent/parent-profile.php:
 * account details, linked children, and a separate change-password form
 * (current + new + confirm, same strength rule as the web).
 */
import { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLiveTicketWidget } from '@/utils/live-ticket-widget';
import { router, useFocusEffect } from 'expo-router';

import AppHeader from '../../components/layout/app-header';
import AnimatedPressable from '../../components/ui/animated-pressable';
import PasswordChecklist from '@/components/ui/password-checklist';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { passwordError } from '@/utils/password';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

type Child = {
  id: number;
  first_name: string;
  last_name: string;
  sr_code: string;
  school_level?: string;
  account_status?: string;
  relationship?: string;
};

export default function ParentProfile() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [children, setChildren] = useState<Child[]>([]);
  const [parentId, setParentId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (!raw) return;
      const u = JSON.parse(raw);
      const id = Number(u.id) || 0;
      setParentId(id);
      setFullName(u.full_name || '');
      setEmail(u.email || '');
      setContact(u.contact_number || '');
      const res = await fetchJsonOrNull(API.getParentProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: id }),
      });
      if (res?.success) {
        setFullName(res.user?.full_name || '');
        setEmail(res.user?.email || '');
        setContact(res.user?.contact_number || '');
        setMemberSince(res.user?.created_at || '');
        setChildren(res.children || []);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveDetails = async () => {
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.updateParentProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_details',
          parent_id: parentId,
          full_name: fullName.trim(),
          email: email.trim(),
          contact_number: contact.trim(),
        }),
      });
      if (res?.success) {
        const raw = await AsyncStorage.getItem('user');
        const u = raw ? JSON.parse(raw) : {};
        Object.assign(u, res.user || { full_name: fullName, email, contact_number: contact });
        await AsyncStorage.setItem('user', JSON.stringify(u));
        if (res.user?.contact_number) setContact(res.user.contact_number);
        clientAlert('Saved', res.message || 'Profile updated.');
      } else {
        clientAlert('Error', res?.message || 'Update failed');
      }
    } catch {
      clientAlert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!currentPw) return clientAlert('Password', 'Enter your current password.');
    const err = passwordError(newPw);
    if (err) return clientAlert('Password', err);
    if (newPw !== confirmPw) return clientAlert('Password', 'New passwords do not match.');
    setPwLoading(true);
    try {
      const res = await fetchJsonOrNull(API.updateParentProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          parent_id: parentId,
          current_password: currentPw,
          new_password: newPw,
          confirm_password: confirmPw,
        }),
      });
      if (res?.success) {
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        clientAlert('Done', res.message || 'Password changed successfully.');
      } else {
        clientAlert('Error', res?.message || 'Could not change password');
      }
    } catch {
      clientAlert('Error', 'Network error');
    } finally {
      setPwLoading(false);
    }
  };

  const logout = () => {
    clientAlert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearLiveTicketWidget();
          await logoutClient();
await AsyncStorage.multiRemove(['user', 'role']);
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Parent Profile" />
      <TutorialScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <TourTarget id="profile"><Text style={{fontSize:16,fontWeight:"700",color:COLORS.primary,marginBottom:12}}>Account profile</Text></TourTarget>
        <View style={styles.panel}>
          <Text style={styles.section}>Account details</Text>
          {!!memberSince && (
            <Text style={styles.meta}>Member since {new Date(memberSince.replace(' ', 'T')).toLocaleDateString()}</Text>
          )}
          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Text style={styles.label}>Contact number</Text>
          <TextInput style={styles.input} value={contact} onChangeText={setContact} keyboardType="phone-pad" placeholder="09XXXXXXXXX" />
          <AnimatedPressable style={[styles.saveBtn, loading && { opacity: 0.6 }]} onPress={saveDetails} disabled={loading}>
            <Text style={styles.saveText}>{loading ? 'Saving…' : 'Save changes'}</Text>
          </AnimatedPressable>
        </View>

        <TourTarget id="linked-accounts"><LinkedAccounts role="parent"/></TourTarget>
        <AnimatedPressable accessibilityRole="button" onPress={() => router.push('/parent/add-child')} style={{minHeight:48,justifyContent:'center',marginBottom:16}}><Text style={{color:COLORS.primary,fontWeight:'700',fontSize:16}}>+ Add or link a child</Text></AnimatedPressable>

        <TourTarget id="password"><View style={styles.panel}>
          <Text style={styles.section}>Change password</Text>
          <Text style={styles.label}>Current password</Text>
          <CustomInput style={styles.input} value={currentPw} onChangeText={setCurrentPw} secureTextEntry />
          <Text style={styles.label}>New password</Text>
          <CustomInput style={styles.input} value={newPw} onChangeText={setNewPw} secureTextEntry />
          <Text style={styles.label}>Confirm new password</Text>
          <CustomInput style={styles.input} value={confirmPw} onChangeText={setConfirmPw} secureTextEntry />
          <PasswordChecklist password={newPw} confirm={confirmPw} />
          <AnimatedPressable style={[styles.saveBtn, pwLoading && { opacity: 0.6 }]} onPress={changePassword} disabled={pwLoading}>
            <Text style={styles.saveText}>{pwLoading ? 'Updating…' : 'Update password'}</Text>
          </AnimatedPressable>
        </View></TourTarget>

        <AnimatedPressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </AnimatedPressable>

</TutorialScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 48 },
  panel: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#f3f4f6' },
  section: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  label: { fontWeight: '600', marginBottom: 6, color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.gray, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: RADIUS.md,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: SPACING.md, fontSize: 16,
  },
  childRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  childName: { fontWeight: '700', color: COLORS.text },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  badgeOk: { backgroundColor: '#dcfce7', color: '#166534' },
  badgeWarn: { backgroundColor: '#fef3c7', color: '#92400e' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveText: { color: '#fff', fontWeight: '700' },
  logoutBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: '#ef4444' },
  logoutText: { color: '#ef4444', fontWeight: '700' },
});
