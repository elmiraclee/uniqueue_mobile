import { useCallback, useState } from 'react';
import {
  Pressable,
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
  const [parentId, setParentId] = useState<number>(0);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);
      setParentId(Number(user.id) || 0);
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

  const unread = items.filter((n) => !n.read_at).length;

  // Same endpoint/scope as the web parent dashboard (mark-notification-read.php).
  const markRead = async (id?: number) => {
    if (!parentId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (!id || n.id === id ? { ...n, read_at: n.read_at || now } : n)));
    await fetchJsonOrNull(API.markNotificationsRead, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { parent_id: parentId, notification_id: id } : { parent_id: parentId }),
    });
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Notifications" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {items.length > 0 && (
          <View style={styles.toolbar}>
            <Text style={styles.unreadText}>{unread > 0 ? `${unread} unread` : 'All caught up'}</Text>
            {unread > 0 && (
              <Pressable onPress={() => markRead()}>
                <Text style={styles.markAll}>Mark all as read</Text>
              </Pressable>
            )}
          </View>
        )}
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={40} color={COLORS.gray} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          items.map((n) => (
            <Pressable
              key={n.id}
              style={[styles.card, !n.read_at && styles.unread]}
              onPress={() => { if (!n.read_at) markRead(Number(n.id)); }}
            >
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
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  unreadText: { color: COLORS.gray, fontWeight: '600' },
  markAll: { color: COLORS.primary, fontWeight: '700' },
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
