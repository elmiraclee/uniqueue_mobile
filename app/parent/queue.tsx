import { useCallback, useState } from 'react';
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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/layout/app-header';
import AnimatedPressable from '../../components/ui/animated-pressable';
import UnavailableServicesModal from '@/components/queue/unavailable-services-modal';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/**
 * Parent office picker → joins a queue on behalf of a linked child.
 * Web parity (parent-dashboard.php / parent-dashboard.js): a child that
 * already has an active queue (or pending feedback) cannot join another one;
 * offices show today's availability, parent-queue setting, active events,
 * and unavailable services can be requested.
 */
export default function ParentQueueForChild() {
  const { forStudentId, childName } = useLocalSearchParams<{ forStudentId?: string; childName?: string }>();
  const childId = Number(forStudentId || 0);
  const [offices, setOffices] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [parentId, setParentId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);
  // Web: "{first} already has an active queue." / pending-feedback block.
  const [childBlock, setChildBlock] = useState<string | null>(null);
  const firstName = String(childName || '').trim().split(/\s+/)[0] || 'This child';

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      const pid = raw ? Number(JSON.parse(raw).id) || 0 : 0;
      setParentId(pid);
      const postJson = (url: string, body: any) =>
        fetchJsonOrNull(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const [data, ev, cur, fb] = await Promise.all([
        fetchJsonOrNull(API.getOffice),
        fetchJsonOrNull(`${API.officeQueue}?action=events`),
        childId ? postJson(API.getCurrentQueue, { parent_id: pid, child_id: childId }) : null,
        childId ? postJson(API.getParentPendingFeedback, { parent_id: pid }) : null,
      ]);
      const hasQueue = !!(cur?.success && (cur.queue || (cur.queues || []).length));
      const hasFeedback = !!(fb?.success && (fb.pending || []).some((f: any) => Number(f.student_id) === childId));
      setChildBlock(
        hasQueue
          ? `${firstName} already has an active queue.`
          : hasFeedback
            ? `Submit ${firstName}’s pending feedback before joining a new queue.`
            : null,
      );
      if (data?.success) setOffices(data.offices || []);
      setEvents(ev?.success ? ev.events || [] : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [childId, firstName]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const blockReason = (o: any): string | null => {
    if (o.parent_queue_enabled === false) return 'This office does not accept parent/guardian queueing.';
    if (o.can_join === false) return o.availability_reason || 'This office is not accepting queues right now.';
    if (o.is_full) return 'This office has reached its daily capacity.';
    return null;
  };

  const go = async (office: any, eventId?: number) => {
    if (!childId) return;
    if (childBlock) {
      Alert.alert('Cannot join', childBlock);
      return;
    }
    const reason = blockReason(office);
    if (reason) {
      Alert.alert(office.name, reason);
      return;
    }
    // Early smart multi-queue check (same as the web dashboard pre-check).
    try {
      const pre = await fetchJsonOrNull(
        `${API.prequeueCheck}?parent_id=${parentId}&child_id=${childId}&office_id=${office.id}&type=walkin&dashboard=1`,
      );
      if (pre?.success && pre.allowed === false) {
        Alert.alert('Cannot join yet', pre.reason + (pre.retry_at ? `\n\nTry again around ${pre.retry_at}.` : ''));
        return;
      }
    } catch {}
    router.push({
      pathname: '/parent/office-queue',
      params: {
        office: office.slug,
        forStudentId: String(childId),
        asParent: '1',
        parentId: String(parentId),
        childName: String(childName || ''),
        ...(eventId ? { event_id: String(eventId) } : {}),
      },
    } as any);
  };

  const hours = (o: any) =>
    o.open_time && o.close_time ? `${String(o.open_time).slice(0, 5)} – ${String(o.close_time).slice(0, 5)}` : null;

  return (
    <View style={styles.container}>
      <AppHeader title="Join queue for child" showBack />
      <Text style={styles.banner}>Queuing for {childName || 'child'}</Text>
      {!!childBlock && <Text style={styles.blockNote}>{childBlock}</Text>}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {events.length > 0 && (
            <>
              <Text style={styles.section}>Active events</Text>
              {events.map((e) => {
                const office = offices.find((o) => Number(o.id) === Number(e.office_id));
                return (
                  <AnimatedPressable key={`ev-${e.id}`} style={styles.card} onPress={() => office && go(office, Number(e.id))}>
                    <View style={[styles.icon, { backgroundColor: '#f59e0b22' }]}>
                      <Ionicons name="calendar-outline" size={22} color="#d97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{e.name}</Text>
                      <Text style={styles.desc} numberOfLines={2}>{office?.name || ''}{e.description ? ` · ${e.description}` : ''}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
                  </AnimatedPressable>
                );
              })}
              <Text style={styles.section}>Offices</Text>
            </>
          )}

          {offices.map((o) => {
            const reason = blockReason(o);
            return (
              <AnimatedPressable key={o.id} style={[styles.card, (!!reason || !!childBlock) && { opacity: 0.6 }]} onPress={() => go(o)}>
                <View style={styles.icon}>
                  <Ionicons name="business-outline" size={22} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{o.name}</Text>
                  {o.description ? <Text style={styles.desc} numberOfLines={2}>{o.description}</Text> : null}
                  <Text style={[styles.status, { color: reason ? '#dc2626' : '#16a34a' }]}>
                    {reason ? (o.parent_queue_enabled === false ? 'Parent queueing off' : o.is_full ? 'Full today' : 'Closed') : 'Open'}
                    {hours(o) ? ` · ${hours(o)}` : ''}
                    {o.cutoff_time && !reason ? ` · cutoff ${String(o.cutoff_time).slice(0, 5)}` : ''}
                  </Text>
                  {reason && o.availability_reason ? <Text style={styles.desc}>{o.availability_reason}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
              </AnimatedPressable>
            );
          })}

          <AnimatedPressable style={styles.unavailBtn} onPress={() => setShowUnavailable(true)}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.unavailText}>Need a service that's unavailable?</Text>
          </AnimatedPressable>
        </ScrollView>
      )}

      <UnavailableServicesModal
        visible={showUnavailable}
        onClose={() => setShowUnavailable(false)}
        studentId={childId}
        parentId={parentId}
        childName={childName}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  blockNote: { marginHorizontal: SPACING.lg, marginBottom: 6, padding: 10, borderRadius: RADIUS.md, backgroundColor: '#fef2f2', color: '#b91c1c', fontWeight: '600', fontSize: 13 },
  banner: { paddingHorizontal: SPACING.lg, paddingVertical: 10, color: COLORS.gray, fontSize: 13 },
  scroll: { padding: SPACING.lg, paddingBottom: 40 },
  section: { fontWeight: '800', color: COLORS.text, marginBottom: 8, marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primary + '15', alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  unavailBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed', marginTop: 6 },
  unavailText: { color: COLORS.primary, fontWeight: '700' },
});
