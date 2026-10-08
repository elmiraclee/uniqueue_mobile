import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { API } from '@/constants/backend';
import { fetchJsonOrNull, safeFetchJson } from '@/utils/api';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface Props {
  visible: boolean;
  studentId: number;
  ticketId: number | null;
  queueNumber?: string | null;
  // Set when a parent responds on behalf of a linked child.
  parentId?: number;
  // Called after the student responds (either action), so the parent can
  // refresh its current-queue state.
  onResolved: (action: 'requeued' | 'cancelled') => void;
}

// Shown when a ticket comes back from polling with is_requeued = true —
// staff skipped the student (e.g. they weren't at the window when
// called) and moved them out of the active slot. The student must
// choose to either rejoin at the back of the line or cancel outright.
// Mirrors public/assets/js/student-dashboard.js's requeue modal on web.
export default function RequeueModal({ visible, studentId, ticketId, queueNumber, parentId, onResolved }: Props) {
  const [submitting, setSubmitting] = useState<'requeue' | 'cancel' | null>(null);

  const respond = async (action: 'requeue' | 'cancel') => {
    if (!ticketId) return;

    try {
      setSubmitting(action);

      const response = await fetch(API.requeueRespond, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          parentId
            ? { parent_id: parentId, child_id: studentId, ticket_id: ticketId, action }
            : { student_id: studentId, ticket_id: ticketId, action },
        ),
      });

      const data = await response.json();

      if (data.success) {
        onResolved(data.action === 'cancelled' ? 'cancelled' : 'requeued');
      } else {
        Alert.alert('Error', data.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.log('REQUEUE RESPOND ERROR:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle" size={32} color={COLORS.warning} />
          </View>

          <Text style={styles.title}>You Were Skipped</Text>

          <Text style={styles.text}>
            Staff moved your ticket{queueNumber ? ` (${queueNumber})` : ''} because you weren&apos;t
            available when called. Would you like to stay in the queue (you&apos;ll go to the
            back of the line) or cancel your ticket?
          </Text>

          <TouchableOpacity
            style={styles.stayButton}
            onPress={() => respond('requeue')}
            disabled={submitting !== null}
            activeOpacity={0.85}
          >
            <Ionicons name="return-down-back-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.stayText}>
              {submitting === 'requeue' ? 'Staying in Queue…' : 'Stay in Queue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => respond('cancel')}
            disabled={submitting !== null}
            activeOpacity={0.85}
          >
            <Text style={styles.cancelText}>
              {submitting === 'cancel' ? 'Cancelling…' : 'Cancel My Queue'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.note}>
            You must respond before you can join another queue.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    padding: SPACING.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.title,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  text: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  stayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    width: '100%',
    marginBottom: SPACING.sm,
    ...SHADOWS.glow,
  },
  stayText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    paddingVertical: SPACING.sm + 2,
    width: '100%',
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  note: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.gray,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});
