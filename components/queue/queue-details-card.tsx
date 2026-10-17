import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import StatusBadge from '../ui/status-badge';

interface Props {
  queue: {
    queue_number: string;
    office_name: string;
    status: string;
    type: string;
    window_name?: string | null;
    people_ahead: number | null;
    joined_at: string;
    priority?: number | boolean;
    priority_reason?: string | null;
  };
}

const Row = ({ label, value, index }: { label: string; value: string; index: number }) => (
  <View style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

export default function QueueDetailsCard({ queue }: Props) {
  const formatDate = (date: string) => new Date(date).toLocaleString();

  const isPriority = !!queue.priority;

  const rows = [
    { label: 'Office', value: queue.office_name },
    { label: 'Queue Type', value: queue.type.toUpperCase() },
    { label: 'Window', value: queue.window_name || 'Not Assigned' },
    { label: 'People Ahead', value: queue.people_ahead == null ? '—' : String(queue.people_ahead) },
    { label: 'Joined', value: formatDate(queue.joined_at) },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.queueNumber}>{queue.queue_number}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badgeWrapper}>
            <StatusBadge status={queue.status} />
          </View>
          {isPriority && (
            <View style={styles.priorityBadge}>
              <Text style={styles.priorityBadgeText}>PRIORITY</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.rowsContainer}>
        {rows.map((r, i) => (
          <Row key={r.label} label={r.label} value={r.value} index={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  header: {
    alignItems: 'center',
    gap: SPACING.xs + 2,
    marginBottom: SPACING.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  badgeWrapper: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  priorityBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 5,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },
  priorityBadgeText: {
    ...TYPOGRAPHY.caption,
    textTransform: 'none',
    letterSpacing: 0.2,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  queueNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  rowsContainer: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  rowAlt: {
    backgroundColor: COLORS.creamDark,
  },
  label: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
    textTransform: 'none',
    letterSpacing: 0,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
});