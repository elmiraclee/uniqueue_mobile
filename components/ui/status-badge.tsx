// components/ui/status-badge.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RADIUS, SPACING, STATUS_BG, STATUS_COLORS, TYPOGRAPHY } from '../../constants/theme';

interface Props {
  status: string;
}

const formatStatus = (status: string) =>
  status
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export default function StatusBadge({ status }: Props) {
  const color = STATUS_COLORS[status] ?? '#7A7A7A';
  const bg = STATUS_BG[status] ?? '#f2f2f2';

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{formatStatus(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingVertical: 5,
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    ...TYPOGRAPHY.caption,
    textTransform: 'none',
    letterSpacing: 0.2,
  },
});