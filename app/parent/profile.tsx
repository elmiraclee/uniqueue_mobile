import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLiveTicketWidget } from '@/utils/live-ticket-widget';
import { router } from 'expo-router';

import AppHeader from '../../components/layout/app-header';
import AnimatedPressable from '../../components/ui/animated-pressable';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function ParentProfile() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [parentId, setParentId] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('user');
      if (!raw) return;
      const u = JSON.parse(raw);
      setParentId(u.id);
      setFullName(u.full_name || '');
      setEmail(u.email || '');
      setContact(u.contact_number || '');
    })();
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.updateParentProfile, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_id: parentId,
          full_name: fullName,
          email,
          contact_number: contact,
          new_password: newPassword || undefined,
        }),
      });
      if (res?.success) {
        const raw = await AsyncStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          u.full_name = fullName;
          u.email = email;
          u.contact_number = contact;
          await AsyncStorage.setItem('user', JSON.stringify(u));
        }
        setNewPassword('');
        Alert.alert('Saved', 'Profile updated');
      } else {
        Alert.alert('Error', res?.message || 'Update failed');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearLiveTicketWidget();
          await AsyncStorage.multiRemove(['user', 'role']);
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Parent Profile" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.label}>Contact number</Text>
        <TextInput
          style={styles.input}
          value={contact}
          onChangeText={setContact}
          keyboardType="phone-pad"
        />
        <Text style={styles.label}>New password (optional)</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          placeholder="Leave blank to keep current"
        />

        <AnimatedPressable
          style={[styles.saveBtn, loading && { opacity: 0.6 }]}
          onPress={save}
          disabled={loading}
        >
          <Text style={styles.saveText}>{loading ? 'Saving…' : 'Save changes'}</Text>
        </AnimatedPressable>

        <AnimatedPressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg },
  label: { fontWeight: '600', marginBottom: 6, color: COLORS.text },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: SPACING.md,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveText: { color: '#fff', fontWeight: '700' },
  logoutBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  logoutText: { color: '#ef4444', fontWeight: '700' },
});
