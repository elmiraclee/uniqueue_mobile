import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/layout/app-header';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function ParentNotifications() {
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);
      const res = await fetchJsonOrNull(API.getParentNotifications, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: user.id }),
      });
      if (res?.success) setItems(res.notifications || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <AppHeader title="Notifications" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={40} color={COLORS.gray} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          items.map((n) => (
            <View key={n.id} style={[styles.card, !n.read_at && styles.unread]}>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.msg}>{n.message}</Text>
              <Text style={styles.meta}>
                {n.first_name} {n.last_name}
                {n.office_name ? ` · ${n.office_name}` : ''}
                {n.queue_number ? ` · #${n.queue_number}` : ''}
              </Text>
              <Text style={styles.time}>
                {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: COLORS.gray, marginTop: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  unread: { borderColor: COLORS.primary + '55', backgroundColor: COLORS.primary + '08' },
  title: { fontWeight: '700', color: COLORS.text },
  msg: { color: COLORS.gray, marginTop: 4 },
  meta: { fontSize: 12, color: COLORS.gray, marginTop: 6 },
  time: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
});
