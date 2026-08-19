import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import AnimatedPressable from '@/components/ui/animated-pressable';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ICON_SIZES, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';
import QueueDetailsCard from './queue-details-card';
import QueueServiceItemsList from './queue-service-items-list';

interface QueueDetails {
  id: number;
  queue_number: string;
  office_name: string;
  status: string;
  type: string;
  joined_at: string;
  window_name?: string | null;
  people_ahead: number;
  service_items: { name: string; quantity: number }[];
  event_step_title?: string | null;
  event_name?: string | null;
  priority?: number | boolean;
  priority_reason?: string | null;
}

interface Props {
  loading: boolean;
  queue: QueueDetails | null;
  onCancel: () => void;
  onClose: () => void;
  onViewLiveQueue: () => void;
}

export default function QueueModalContent({ loading, queue, onCancel, onClose, onViewLiveQueue}: Props) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading queue details…</Text>
      </View>
    );
  }

  if (!queue) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="time-outline" size={ICON_SIZES.xl} color={COLORS.primaryLight} />
        </View>
        <Text style={styles.emptyTitle}>No Active Queue</Text>
        <Text style={styles.emptySubtitle}>You don't have a queue in progress right now.</Text>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <Text style={styles.title}>Queue Details</Text>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <QueueDetailsCard queue={queue} />
        <QueueServiceItemsList
          service_items={queue.service_items}
          eventStepTitle={queue.event_step_title}
          eventName={queue.event_name}
        />
      </ScrollView>

      <AnimatedPressable
        style={styles.liveQueueButton}
        onPress={onViewLiveQueue}
      >
        <Ionicons
          name="pulse-outline"
          size={18}
          color={COLORS.white}
        />

        <Text style={styles.liveQueueText}>
          View Live Queue
        </Text>
      </AnimatedPressable>

      {queue.status === 'waiting' && (
        <AnimatedPressable style={styles.cancelButton} onPress={onCancel}>
          <Ionicons name="close-circle-outline" size={18} color={COLORS.dangerDark} />
          <Text style={styles.cancelText}>Cancel Queue</Text>
        </AnimatedPressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  scrollArea: {
    maxHeight: 420,
  },
  scrollContent: {
    gap: SPACING.sm,
  },
  loadingContainer: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    color: COLORS.gray,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.secondary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 4,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  title: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.md,
    color: COLORS.secondary,
    textAlign: 'center',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.dangerLight,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },
  cancelText: {
    color: COLORS.dangerDark,
    fontWeight: '700',
    fontSize: 14,
  },
  liveQueueButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
  },

  liveQueueText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },
});