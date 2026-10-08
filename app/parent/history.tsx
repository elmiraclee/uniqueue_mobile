/**
 * Parent transaction history — mobile version of web parent/parent-transaction.php:
 * child + status filters, search, summary stats, pagination, a detail
 * sheet with the ticket timeline, and feedback for completed tickets.
 */
import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

import AppHeader from '../../components/layout/app-header';
import StatusBadge from '../../components/ui/status-badge';
import FeedbackModal from '@/components/feedback/feedback-modal';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'called', label: 'Called' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const fmt = (v?: string | null) => (v ? new Date(v.replace(' ', 'T')).toLocaleString() : null);

export default function ParentHistory() {
  const [items, setItems] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; completed: number; cancelled: number; active: number } | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [child, setChild] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<any | null>(null);

  const load = useCallback(
    async (opts: { q?: string; st?: string; ch?: number; pg?: number } = {}) => {
      try {
        const raw = await AsyncStorage.getItem('user');
        if (!raw) return;
        const user = JSON.parse(raw);
        const res = await fetchJsonOrNull(API.getParentTransactions, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parent_id: user.id,
            search: opts.q ?? search,
            status: opts.st ?? status,
            child: opts.ch ?? child,
            page: opts.pg ?? page,
          }),
        });
        if (res?.success) {
          setItems(res.transactions || []);
          setChildren(res.children || []);
          setStats(res.stats || null);
          setTotalPages(res.total_pages || 1);
          setPage(res.page || 1);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [search, status, child, page],
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );

  const canFeedback = (t: any) => ['completed', 'done'].includes(t.status) && !t.has_feedback;

  return (
    <View style={styles.container}>
      <AppHeader title="Queue history" />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search queue #, office, child…"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load({ q: search, pg: 1 })}
          returnKeyType="search"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <Chip label="All children" active={child === 0} onPress={() => { setChild(0); setPage(1); }} />
          {children.map((c) => (
            <Chip key={c.id} label={c.first_name} active={child === Number(c.id)} onPress={() => { setChild(Number(c.id)); setPage(1); }} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          {STATUSES.map((s) => (
            <Chip key={s.value} label={s.label} active={status === s.value} onPress={() => { setStatus(s.value); setPage(1); }} />
          ))}
        </ScrollView>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {stats && (
          <View style={styles.stats}>
            {[
              ['Total', stats.total],
              ['Active', stats.active],
              ['Completed', stats.completed],
              ['Cancelled', stats.cancelled],
            ].map(([l, v]) => (
              <View key={String(l)} style={styles.stat}>
                <Text style={styles.statNum}>{v}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
        )}

        {items.map((t) => (
          <Pressable key={t.id} style={styles.card} onPress={() => setDetail(t)}>
            <View style={styles.row}>
              <Text style={styles.qn}>#{t.queue_number}</Text>
              <StatusBadge status={t.status} />
            </View>
            <Text style={styles.office}>{t.office_name}</Text>
            <Text style={styles.child}>{t.first_name} {t.last_name} ({t.sr_code})</Text>
            {!!t.service_items && <Text style={styles.meta} numberOfLines={1}>{t.service_items}</Text>}
            <Text style={styles.meta}>
              {t.type === 'appointment' ? 'Appointment' : 'Walk-in'}
              {t.created_by_role === 'parent' ? ' · queued by you' : ''}
              {' · '}
              {fmt(t.joined_at || t.created_at)}
            </Text>
            {canFeedback(t) && (
              <Pressable onPress={() => setFeedbackTarget(t)} style={styles.fbBtn}>
                <Text style={styles.fbText}>Give feedback</Text>
              </Pressable>
            )}
            {t.has_feedback && <Text style={styles.rated}>Rated {'★'.repeat(t.feedback_rating || 0)}</Text>}
          </Pressable>
        ))}
        {items.length === 0 && (
          <Text style={{ textAlign: 'center', color: COLORS.gray, marginTop: 24 }}>No transactions found</Text>
        )}

        {totalPages > 1 && (
          <View style={styles.pager}>
            <Pressable disabled={page <= 1} onPress={() => setPage(page - 1)}>
              <Text style={[styles.pagerBtn, page <= 1 && { opacity: 0.3 }]}>‹ Prev</Text>
            </Pressable>
            <Text style={styles.meta}>Page {page} of {totalPages}</Text>
            <Pressable disabled={page >= totalPages} onPress={() => setPage(page + 1)}>
              <Text style={[styles.pagerBtn, page >= totalPages && { opacity: 0.3 }]}>Next ›</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {detail && (
              <>
                <View style={styles.row}>
                  <Text style={styles.qn}>#{detail.queue_number}</Text>
                  <StatusBadge status={detail.status} />
                </View>
                <Text style={styles.office}>{detail.office_name} — {detail.first_name} {detail.last_name}</Text>
                {[
                  ['Type', detail.type === 'appointment' ? 'Appointment' : 'Walk-in'],
                  ['Priority', detail.priority ? 'Yes' : 'No'],
                  ['Window', detail.window_name],
                  ['Services', detail.service_items],
                  ['Queued by', detail.created_by_role === 'parent' ? 'Parent / Guardian' : 'Student'],
                  ['Joined', fmt(detail.joined_at || detail.created_at)],
                  ['Called', fmt(detail.called_at)],
                  ['Completed', fmt(detail.done_at)],
                  ['Rating', detail.has_feedback ? '★'.repeat(detail.feedback_rating || 0) : null],
                  ['Comment', detail.feedback_comment],
                ]
                  .filter(([, v]) => !!v)
                  .map(([k, v]) => (
                    <View key={String(k)} style={styles.detailRow}>
                      <Text style={styles.detailKey}>{k}</Text>
                      <Text style={styles.detailVal}>{v}</Text>
                    </View>
                  ))}
                {canFeedback(detail) && (
                  <Pressable onPress={() => { setFeedbackTarget(detail); setDetail(null); }} style={[styles.fbBtn, { marginTop: 12 }]}>
                    <Text style={styles.fbText}>Give feedback</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => setDetail(null)} style={{ marginTop: 16, alignItems: 'center' }}>
                  <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {feedbackTarget && (
        <FeedbackModal
          visible={!!feedbackTarget}
          transaction={{
            ticket_id: Number(feedbackTarget.id),
            queue_number: feedbackTarget.queue_number,
            type: feedbackTarget.type,
            office_name: feedbackTarget.office_name,
            done_at: feedbackTarget.done_at,
            created_at: feedbackTarget.created_at,
          } as any}
          studentId={Number(feedbackTarget.student_id)}
          onClose={() => setFeedbackTarget(null)}
          onSubmitted={() => { setFeedbackTarget(null); load(); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchWrap: { paddingHorizontal: SPACING.lg, paddingTop: 8 },
  search: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary, marginRight: 6, backgroundColor: '#fff' },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  scroll: { padding: SPACING.lg },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center' },
  statNum: { fontWeight: '800', fontSize: 18, color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.gray },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qn: { fontWeight: '800', fontSize: 18, color: COLORS.primary },
  office: { fontWeight: '600', marginTop: 4, color: COLORS.text },
  child: { color: COLORS.gray, marginTop: 2 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  fbBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md },
  fbText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  rated: { marginTop: 6, color: '#f59e0b', fontSize: 12, fontWeight: '700' },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  pagerBtn: { color: COLORS.primary, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, paddingBottom: 32 },
  detailRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailKey: { width: 100, color: COLORS.gray, fontSize: 13 },
  detailVal: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '600' },
});
