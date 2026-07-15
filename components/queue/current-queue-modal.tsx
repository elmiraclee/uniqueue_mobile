import React, { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';

import { API } from '@/constants/backend';
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
  documents: { name: string; quantity: number }[];
}

export default function CurrentQueueModal({ visible, studentId, onClose, onCancelled }: Props) {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueueDetails | null>(null);

  useEffect(() => {
    if (visible) loadQueue();
  }, [visible]);

  const loadQueue = async () => {
    try {
      setLoading(true);

      const response = await fetch(API.getQueueDetails, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });

      const data = await response.json();

      if (data.success) {
        setQueue(data.queue);
      } else {
        Alert.alert('Error', data.message);
        setQueue(null);
      }
    } catch (error) {
      console.log('QUEUE DETAILS ERROR:', error);
      Alert.alert('Error', 'Unable to load queue details.');
    } finally {
      setLoading(false);
    }
  };

  const confirmCancel = () => {
    if (!queue) return;

    Alert.alert('Cancel Queue', 'Are you sure you want to cancel your queue?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: cancelQueue },
    ]);
  };

  const cancelQueue = async () => {
    if (!queue) return;

    try {
      setLoading(true);

      const response = await fetch(API.cancelQueue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, queue_id: queue.id }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Success', data.message);
        onCancelled();
        onClose();
      } else {
        Alert.alert('Unable to Cancel', data.message);
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Something went wrong.');
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