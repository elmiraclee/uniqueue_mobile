import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/layout/app-header';
import AnimatedPressable from '../../components/ui/animated-pressable';
import StatusBadge from '../../components/ui/status-badge';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

function paramStr(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v);
}
function paramInt(v: unknown): number {
  const n = parseInt(paramStr(v), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * View Ticket — web parity with student-queue-ticket.php
 * Params: ticketId | queueId, optional studentId, parentId (parent actor)
 */
export default function TicketDetailScreen() {
  const params = useLocalSearchParams();
  const ticketId = paramInt(params.ticketId) || paramInt(params.queueId) || paramInt(params.id);
  const childId = paramInt(params.childId) || paramInt(params.studentId);
  const parentIdParam = paramInt(params.parentId);
  const asParent = paramStr(params.asParent) === '1' || parentIdParam > 0;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ticket, setTicket] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const raw = await AsyncStorage.getItem('user');
      const role = await AsyncStorage.getItem('role');
      const user = raw ? JSON.parse(raw) : null;
      if (!ticketId) {
        setError('Ticket ID required');
        return;
      }

      const body: any = { ticket_id: ticketId };
      if (role === 'parent' || asParent) {
        body.parent_id = parentIdParam || user?.id;
        if (childId) body.student_id = childId;
      } else {
        body.student_id = childId || user?.id;
      }

      const res = await fetchJsonOrNull(API.getTicketDetail, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res?.success) setTicket(res.ticket);
      else setError(res?.message || 'Ticket not found');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ticketId, childId, parentIdParam, asParent]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const cancel = () => {
    if (!ticket?.can_cancel) return;
    Alert.alert('Cancel queue', 'Cancel this queue? This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const raw = await AsyncStorage.getItem('user');
            const role = await AsyncStorage.getItem('role');
            const user = raw ? JSON.parse(raw) : null;
            const body: any = {
              queue_id: ticket.id,
              student_id: ticket.student_id,
            };
            if (role === 'parent' || asParent) {
              body.parent_id = parentIdParam || user?.id;
            }
            const res = await fetchJsonOrNull(API.cancelQueue, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (res?.success) {
              Alert.alert('Cancelled', res.message || 'Queue cancelled', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } else {
              Alert.alert('Error', res?.message || 'Could not cancel');
            }
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader title="View Ticket" showBack />
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      </View>
    );
  }

  if (error || !ticket) {
    return (
      <View style={styles.container}>
        <AppHeader title="View Ticket" showBack />
        <Text style={styles.error}>{error || 'Not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title="View Ticket" showBack />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {(asParent || ticket.first_name) && (
          <Text style={styles.viewingAs}>
            Viewing {ticket.first_name} {ticket.last_name}
            {ticket.sr_code ? ` (${ticket.sr_code})` : ''}
            {asParent ? ' as parent / guardian' : ''}
          </Text>
        )}

        <View style={styles.hero}>
          <Text style={styles.office}>{ticket.office_name}</Text>
          <StatusBadge status={ticket.status} />
          <Text style={styles.qn}>#{ticket.queue_number}</Text>
          <Text style={styles.meta}>
            {ticket.type}
            {ticket.priority ? ' · Priority' : ''}
            {ticket.window_name ? ` · ${ticket.window_name}` : ''}
          </Text>
          {ticket.event_name ? (
            <Text style={styles.meta}>Event: {ticket.event_name}</Text>
          ) : null}
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Ahead</Text>
            <Text style={styles.statVal}>{ticket.people_ahead ?? '—'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Now serving</Text>
            <Text style={styles.statVal}>{ticket.now_serving || '—'}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Window</Text>
            <Text style={styles.statVal}>{ticket.window_name || 'TBA'}</Text>
          </View>
        </View>

        <Text style={styles.section}>Services</Text>
        {(ticket.service_items || []).map((it: any, i: number) => (
          <View key={i} style={styles.itemCard}>
            <Text style={styles.itemName}>
              {it.name}
              {it.choice_label ? ` — ${it.choice_label}` : ''}
              {it.quantity > 1 ? ` ×${it.quantity}` : ''}
            </Text>
            {(it.requirements || []).map((r: string, j: number) => (
              <Text key={j} style={styles.req}>• {r}</Text>
            ))}
            {(it.academic || []).map((a: any, j: number) => (
              <Text key={`a${j}`} style={styles.req}>
                Copy {a.copy_number}: {a.academic_period} / {a.school_year}
              </Text>
            ))}
          </View>
        ))}

        {ticket.can_cancel && (
          <AnimatedPressable
            style={[styles.cancelBtn, cancelling && { opacity: 0.6 }]}
            onPress={cancel}
            disabled={cancelling}
          >
            <Ionicons name="close-circle-outline" size={20} color="#b91c1c" />
            <Text style={styles.cancelText}>{cancelling ? 'Cancelling…' : 'Cancel Queue'}</Text>
          </AnimatedPressable>
        )}

        <AnimatedPressable
          style={styles.liveBtn}
          onPress={() =>
            router.push({
              pathname: asParent ? '/parent/live-queue' : '/student/live-queue',
              params: {
                queueId: String(ticket.id),
                studentId: String(ticket.student_id),
                childId: String(ticket.student_id),
              },
            } as any)
          }
        >
          <Text style={styles.liveBtnText}>Open live queue board</Text>
        </AnimatedPressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  error: { textAlign: 'center', marginTop: 40, color: COLORS.gray },
  viewingAs: { color: COLORS.gray, marginBottom: 12, fontSize: 13 },
  hero: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'flex-start',
    gap: 6,
  },
  office: { fontWeight: '700', fontSize: 16, color: COLORS.text },
  qn: { fontSize: 36, fontWeight: '800', color: COLORS.primary, marginVertical: 4 },
  meta: { color: COLORS.gray, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: COLORS.gray },
  statVal: { fontWeight: '800', fontSize: 16, color: COLORS.text, marginTop: 4 },
  section: { fontWeight: '700', marginTop: 20, marginBottom: 8, color: COLORS.text },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
  },
  itemName: { fontWeight: '600', color: COLORS.text },
  req: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  cancelBtn: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#fecaca',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  cancelText: { color: '#b91c1c', fontWeight: '700' },
  liveBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  liveBtnText: { color: '#fff', fontWeight: '700' },
});
