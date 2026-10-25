import { clientAlert } from '@/components/client/client-ui';
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
import { formatDuration } from '@/utils/format-duration';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/** Port of web queue-ticket-live.js copyFor(): headline + sub per state. */
function liveCopy(status: string, ahead: number, isParent: boolean, subject: string) {
  if (status === 'completed' || status === 'done') {
    return {
      head: isParent ? `${subject} is done` : 'Your transaction is complete',
      sub: isParent
        ? 'The transaction has been completed. Feedback can be submitted from your dashboard.'
        : 'Thanks for queueing. Please submit your feedback before joining another queue.',
    };
  }
  if (status === 'cancelled') {
    return {
      head: isParent ? `${subject}'s queue was cancelled` : 'Your queue was cancelled',
      sub: 'This ticket is no longer in the queue.',
    };
  }
  if (status === 'reserved') {
    return {
      head: isParent ? `${subject} has a reserved queue` : 'Your queue is reserved',
      sub: isParent
        ? `The queue will activate after ${subject}'s current office service is completed.`
        : 'This queue is held safely while your current office service is being completed.',
    };
  }
  if (status === 'in_progress') {
    return {
      head: isParent ? `${subject} is being served now` : 'You are being served now',
      sub: isParent ? 'Staff are handling the transaction at the window.' : 'Please stay at the window until staff finish.',
    };
  }
  if (status === 'called') {
    return {
      head: isParent ? `${subject} has been called` : "It's your turn",
      sub: isParent ? `Please make sure ${subject} proceeds to the window now.` : 'Please proceed to your window now.',
    };
  }
  if (status === 'next' || ahead === 0) {
    return {
      head: isParent ? `${subject} is next in line` : "You're next in line",
      sub: isParent
        ? `Have ${subject} ready — the window will call them shortly.`
        : 'Get ready — your window will call you shortly.',
    };
  }
  if (ahead === 1) {
    return { head: isParent ? `1 person ahead of ${subject}` : '1 person ahead of you', sub: 'Almost there.' };
  }
  return {
    head: `${ahead} people ahead of ${isParent ? subject : 'you'}`,
    sub: 'Still waiting. This updates on its own.',
  };
}

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
    clientAlert('Cancel queue', 'Cancel this queue? This cannot be undone.', [
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
              clientAlert('Cancelled', res.message || 'Queue cancelled', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } else {
              clientAlert('Error', res?.message || 'Could not cancel');
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

{(() => {
          const status = String(ticket.status || 'waiting');
          const ahead = typeof ticket.people_ahead === 'number' ? ticket.people_ahead : 0;
          const isOver = ['completed', 'done', 'cancelled', 'expired'].includes(status);
          const skipped = !!ticket.is_requeued && !['completed', 'done', 'cancelled', 'expired'].includes(status);
          const subject = ticket.first_name || 'Your child';
          // Skipped by staff and not answered yet: out of the line (no position / ETA).
          const copy = skipped
            ? {
                head: asParent ? `${subject} was skipped` : 'You were skipped',
                sub: 'Not in line right now. Choose to rejoin (end of the line) or cancel.',
              }
            : liveCopy(status, ahead, asParent, subject);
          let note: string | null = null;
          if (!isOver && ticket.is_reserved) {
            note = 'Reserved queue: it will become active automatically after your current office service is completed.';
          } else if (!isOver && ticket.all_windows_closed) {
            note = 'Every window in this office is closed right now, so no one can be called yet. The ticket keeps its place in line.';
          } else if (skipped) {
            note = 'Skipped tickets are not counted in the line until you respond. Rejoining puts you at the end of the line.';
          }
          return (
            <View style={styles.livePanel}>
              <Text style={styles.liveHead}>{copy.head}</Text>
              <Text style={styles.liveSub}>{copy.sub}</Text>
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Ahead</Text>
                  <Text style={styles.statVal}>{isOver || skipped ? '—' : ahead}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Est. wait</Text>
                  <Text style={styles.statVal}>
                    {isOver || skipped ? '—' : formatDuration(ticket.estimated_wait_minutes)}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Window</Text>
                  <Text style={styles.statVal} numberOfLines={1}>{ticket.window_name || 'To be assigned'}</Text>
                </View>
              </View>
              {!isOver && !skipped && !!ticket.estimated_label && (
                <Text style={styles.liveEta}>Estimated call time: {ticket.estimated_label}</Text>
              )}
              {!!ticket.now_serving && !isOver && (
                <Text style={styles.liveEta}>Now serving: {ticket.now_serving}</Text>
              )}
              {!!note && <Text style={styles.liveNote}>{note}</Text>}
            </View>
          );
        })()}

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
  livePanel: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: 12 },
  liveHead: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  liveSub: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  liveEta: { fontSize: 13, color: COLORS.text, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  liveNote: { fontSize: 12, color: '#92400e', backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginTop: 10 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: COLORS.background,
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
