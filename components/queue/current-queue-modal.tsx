import { clientAlert } from '@/components/client/client-ui';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { API } from '@/constants/backend';
import { fetchJsonOrNull, safeFetchJson } from '@/utils/api';
import { COLORS, ICON_SIZES, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { TouchableOpacity } from "react-native";
import QueueModalContent from './queue-modal-content';

interface Props {
  visible: boolean;
  studentId: number;
  onClose: () => void;
  onCancelled: () => void;
  onCompleted?: () => void;
}

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

export default function CurrentQueueModal({ visible, studentId, onClose, onCancelled, onCompleted }: Props) {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueueDetails | null>(null);
  const queueRef = useRef<QueueDetails | null>(null);

  useEffect(() => {
    if (!visible) return;

    loadQueue();

    // Keep polling in the background while the modal is open so we can
    // notice on our own when the ticket wraps up (marked done on the
    // backend) and dissolve the modal instead of leaving it stuck open.
    const interval = setInterval(() => loadQueue(true), 5000);

    return () => clearInterval(interval);
  }, [visible]);

  const loadQueue = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);

      const data = await fetchJsonOrNull(API.getQueueDetails, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      }, 'Get Queue Details Error');

      if (data?.success) {
        setQueue(data.queue);
        queueRef.current = data.queue;
      } else {
        const hadActiveQueue = queueRef.current !== null;

        setQueue(null);
        queueRef.current = null;

        if (hadActiveQueue) {
          // The ticket we were showing is no longer active (it was
          // completed, cleared, etc. on the backend) — dissolve the
          // modal on its own rather than leaving stale details on screen.
          onClose();
          (onCompleted ?? onCancelled)();
        } else if (!silent) {
          clientAlert('Error', data.message);
        }
      }
    } catch (error) {
      console.log('QUEUE DETAILS ERROR:', error);
      if (!silent) clientAlert('Error', 'Unable to load queue details.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const confirmCancel = () => {
    if (!queue) return;

    clientAlert('Cancel Queue', 'Are you sure you want to cancel your queue?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: cancelQueue },
    ]);
  };

  const cancelQueue = async () => {
    if (!queue) return;

    try {
      setLoading(true);

      const data = await fetchJsonOrNull(API.cancelQueue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, queue_id: queue.id }),
      }, 'Cancel Queue Error');

      if (data?.success) {
        clientAlert('Success', data.message);
        queueRef.current = null;
        onCancelled();
        onClose();
      } else {
        clientAlert('Unable to Cancel', data.message);
      }
    } catch (error) {
      console.log(error);
      clientAlert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={8}
          >
            <Ionicons
              name="close"
              size={ICON_SIZES.lg}
              color={COLORS.gray}
            />
          </TouchableOpacity>
          <View style={styles.grabber} />
          <QueueModalContent
            loading={loading}
            queue={queue}
            onCancel={confirmCancel}
            onClose={onClose}
            onViewLiveQueue={() => {
              onClose();

              router.push({
                pathname: "/student/live-queue",
                params: {
                  queueId: queue?.id,
                },
              });
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: COLORS.overlay,
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xxl,
    maxHeight: '92%',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.border,
    marginTop: SPACING.sm + 2,
    marginBottom: -4,
  },
  closeButton: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 100,
  },
});