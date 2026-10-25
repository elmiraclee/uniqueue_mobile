import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { API } from '@/constants/backend';
import { fetchJsonOrNull, safeFetchJson } from '@/utils/api';
import {
    COLORS,
    ICON_SIZES,
    RADIUS,
    SHADOWS,
    SPACING,
    TYPOGRAPHY,
} from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Office {
  id: number;
  name: string;
  slug: string;
  description: string;
  open_windows: number;
}

interface QueueTicket {
  id: number;
  queue_number: string;
  status: 'waiting' | 'in_progress' | 'called';
  priority: boolean;
  joined_at: string;
}

interface WindowData {
  id: number;
  name: string;
  speed: 'fast' | 'normal' | 'slow';
  queue_type: 'walkin' | 'appointment' | 'both';
  is_paused: boolean;
  now_serving: string | null;
  waiting: number;
  queue: QueueTicket[];
}

interface LiveQueueData {
  office: { id: number; name: string };
  open_windows: number;
  windows: WindowData[];
}

interface Props {
  visible: boolean;
  office: Office | null;
  onClose: () => void;
  onJoinQueue: () => void;
  pendingFeedback: boolean;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'Serving',
  called:      'Called',
  waiting:     'Waiting',
};

const STATUS_COLOR: Record<string, string> = {
  in_progress: COLORS.purple,
  called:      COLORS.info,
  waiting:     COLORS.warning,
};

const STATUS_BG: Record<string, string> = {
  in_progress: COLORS.purpleLight,
  called:      COLORS.infoLight,
  waiting:     COLORS.warningLight,
};

const SPEED_LABEL: Record<string, string> = {
  fast:   '⚡ Fast',
  normal: '🕐 Normal',
  slow:   '🐢 Slow',
};

const POLL_MS = 4000;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TicketRow({ ticket }: { ticket: QueueTicket }) {
  const isActive = ticket.status !== 'waiting';

  return (
    <View style={[styles.ticketRow, isActive && styles.ticketRowActive]}>
      <View style={styles.ticketLeft}>
        {ticket.priority && (
          <Ionicons name="star" size={11} color={COLORS.warning} style={{ marginRight: 4 }} />
        )}
        <Text style={[styles.ticketNumber, isActive && styles.ticketNumberActive]}>
          {ticket.queue_number}
        </Text>
      </View>

      <View style={[styles.statusPill, { backgroundColor: STATUS_BG[ticket.status] }]}>
        <Text style={[styles.statusPillText, { color: STATUS_COLOR[ticket.status] }]}>
          {STATUS_LABEL[ticket.status]}
        </Text>
      </View>
    </View>
  );
}

function WindowCard({ window }: { window: WindowData }) {
  return (
    <View style={[styles.windowCard, window.is_paused && styles.windowCardPaused]}>
      {/* Window header */}
      <View style={styles.windowHeader}>
        <View style={styles.windowTitleRow}>
          <View style={styles.windowIconBox}>
            <Ionicons name="desktop-outline" size={14} color={COLORS.primary} />
          </View>
          <Text style={styles.windowName}>{window.name}</Text>

          {window.is_paused && (
            <View style={styles.pausedBadge}>
              <Ionicons name="pause" size={9} color={COLORS.warning} />
              <Text style={styles.pausedBadgeText}>Paused</Text>
            </View>
          )}
        </View>

        <Text style={styles.speedLabel}>{SPEED_LABEL[window.speed] ?? window.speed}</Text>
      </View>

      {/* Now serving */}
      <View style={styles.nowServingRow}>
        <Text style={styles.nowServingLabel}>Now Serving</Text>
        <Text style={styles.nowServingNumber}>
          {window.now_serving ?? '—'}
        </Text>
      </View>

      {/* Waiting count */}
      <View style={styles.waitingRow}>
        <Ionicons name="people-outline" size={13} color={COLORS.gray} />
        <Text style={styles.waitingText}>
          {window.waiting === 0
            ? 'No one waiting'
            : `${window.waiting} ${window.waiting === 1 ? 'person' : 'people'} waiting`}
        </Text>
      </View>

      {/* Queue list */}
      {window.queue.length > 0 ? (
        <View style={styles.queueList}>
          {window.queue.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyQueue}>
          <Text style={styles.emptyQueueText}>Queue is empty</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export default function LiveQueueModal({
  visible,
  office,
  onClose,
  onJoinQueue,
  pendingFeedback,
}: Props) {
  const [data, setData] = useState<LiveQueueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQueue = useCallback(
    async (silent = false) => {
      if (!office) return;

      try {
        if (!silent) setLoading(true);
        setError(null);

        const json = await fetchJsonOrNull(`${API.officeQueue}?office_id=${office.id}`);

        if (json.success) {
          setData(json);
        } else {
          setError(json.message ?? 'Failed to load queue.');
        }
      } catch {
        if (!silent) setError('Network error. Please try again.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [office]
  );

  useEffect(() => {
    if (!visible || !office) {
      setData(null);
      setError(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    fetchQueue();
    intervalRef.current = setInterval(() => fetchQueue(true), POLL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, office]);

  const openWindows = data?.open_windows ?? 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>

          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={ICON_SIZES.lg} color={COLORS.gray} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconBox}>
              <Ionicons name="pulse-outline" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {office?.name ?? 'Live Queue'}
              </Text>
              <Text style={styles.headerSub}>
                {loading && !data
                  ? 'Loading...'
                  : openWindows > 0
                  ? `${openWindows} window${openWindows > 1 ? 's' : ''} open`
                  : 'No open windows'}
              </Text>
            </View>

            {/* Live indicator */}
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading && !data ? (
              <View style={styles.centerState}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={styles.centerStateText}>Loading queue...</Text>
              </View>
            ) : error ? (
              <View style={styles.centerState}>
                <Ionicons name="wifi-outline" size={40} color={COLORS.gray} />
                <Text style={styles.centerStateText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => fetchQueue()}>
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : data?.windows.length === 0 ? (
              <View style={styles.centerState}>
                <Ionicons name="time-outline" size={40} color={COLORS.gray} />
                <Text style={styles.centerStateTitle}>No open windows</Text>
                <Text style={styles.centerStateText}>
                  Check back later — windows will open throughout the day.
                </Text>
              </View>
            ) : (
              data?.windows.map((w) => (
                <WindowCard key={w.id} window={w} />
              ))
            )}
          </ScrollView>

          {/* Footer — Join Queue */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.joinBtn, pendingFeedback && styles.joinBtnDisabled]}
              onPress={onJoinQueue}
              disabled={pendingFeedback}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
              <Text style={styles.joinBtnText}>Join Queue</Text>
            </TouchableOpacity>

            {pendingFeedback && (
              <Text style={styles.pendingHint}>
                Rate your last visit to unlock joining.
              </Text>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  modal: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    maxHeight: '88%',
    ...SHADOWS.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginTop: SPACING.sm + 2,
  },
  closeBtn: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 100,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.secondary,
    fontSize: 15,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.danger,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.danger,
    letterSpacing: 0.5,
  },

  // Scroll
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  // Center states (loading / error / empty)
  centerState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  centerStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  centerStateText: {
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: '500',
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 2,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
  },
  retryBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },

  // Window card
  windowCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  windowCardPaused: {
    opacity: 0.7,
    borderColor: COLORS.warning,
  },
  windowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.primarySoft,
  },
  windowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  windowIconBox: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  pausedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: SPACING.sm - 2,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  pausedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.warning,
    letterSpacing: 0.3,
  },
  speedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray,
  },

  // Now serving
  nowServingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  nowServingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  nowServingNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },

  // Waiting count
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  waitingText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },

  // Ticket rows
  queueList: {
    padding: SPACING.sm,
    gap: 4,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cream,
  },
  ticketRowActive: {
    backgroundColor: COLORS.primarySoft,
  },
  ticketLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ticketNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  ticketNumberActive: {
    color: COLORS.primary,
  },
  statusPill: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Empty queue state
  emptyQueue: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  emptyQueueText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },

  // Footer
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.sm,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.md,
  },
  joinBtnDisabled: {
    opacity: 0.45,
  },
  joinBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  pendingHint: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
});