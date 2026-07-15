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
    people_ahead: number;
    joined_at: string;
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

  const rows = [
    { label: 'Office', value: queue.office_name },
    { label: 'Queue Type', value: queue.type.toUpperCase() },
    { label: 'Window', value: queue.window_name || 'Not Assigned' },
    { label: 'People Ahead', value: String(queue.people_ahead) },
    { label: 'Joined', value: formatDate(queue.joined_at) },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.queueNumber}>{queue.queue_number}</Text>
        <View style={styles.badgeWrapper}>
          <StatusBadge status={queue.status} />
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
  badgeWrapper: {
    alignSelf: 'center',
    alignItems: 'center',
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