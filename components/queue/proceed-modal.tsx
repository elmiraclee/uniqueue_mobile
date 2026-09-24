import { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../../constants/theme';

/*
| The audible part of this alert is the DEVICE'S notification sound,
| played by the system notification that use-notification.tsx posts (or
| that arrives as a server push). This modal only owns the on-screen
| blocking prompt and the vibration — it never plays a bundled mp3 on the
| media stream, so the alert follows the phone's notification volume and
| still fires when the app is closed.
*/
export interface ProceedInfo {
  queueNumber?: string | null;
  officeName?: string | null;
  windowName?: string | null;
  status?: string | null;
}

/**
 * 'next'    -> the student is next in line (get ready)
 * 'proceed' -> the student is being called / served (go now)
 */
export type ProceedKind = 'next' | 'proceed';

interface Props {
  visible: boolean;
  info?: ProceedInfo | null;
  kind?: ProceedKind;
  onAcknowledge: () => void;
}

/**
 * Blocking alert modal.
 * - Vibrates repeatedly while open (sound comes from the system notification)
 * - Does NOT dismiss until the user presses OK
 */
export default function ProceedModal({
  visible,
  info,
  kind = 'proceed',
  onAcknowledge,
}: Props) {
  const vibrateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const startAlarm = () => {
      // Vibration pattern: short pulses every ~1.2s while the modal is open.
      const pulse = () => {
        try {
          if (Platform.OS === 'android') {
            Vibration.vibrate([0, 400, 200, 400]);
          } else {
            Vibration.vibrate(400);
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error
            ).catch(() => {});
          }
        } catch {
          // ignore
        }
      };

      pulse();
      vibrateTimerRef.current = setInterval(pulse, 1200);
    };

    const stopAlarm = () => {
      if (vibrateTimerRef.current) {
        clearInterval(vibrateTimerRef.current);
        vibrateTimerRef.current = null;
      }
      try {
        Vibration.cancel();
      } catch {
        // ignore
      }
    };

    if (visible) {
      startAlarm();
    } else {
      stopAlarm();
    }

    return stopAlarm;
  }, [visible]);

  const handleOk = () => {
    onAcknowledge();
  };

  const status = (info?.status || '').toLowerCase();
  const isNext = kind === 'next';
  const title = isNext ? "You're Next in Line" : 'Please Proceed Now';
  const subtitle = isNext
    ? 'Get ready and stay near the window — you will be called next.'
    : status === 'in_progress'
      ? 'You are being served — please go to the window.'
      : 'Please proceed to the window now.';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      // Block Android back button — only OK dismisses
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={isNext ? 'alert-circle' : 'notifications'}
              size={36}
              color="#fff"
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {(info?.queueNumber || info?.officeName || info?.windowName) && (
            <View style={styles.details}>
              {!!info?.queueNumber && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ticket</Text>
                  <Text style={styles.detailValue}>{info.queueNumber}</Text>
                </View>
              )}
              {!!info?.officeName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Office</Text>
                  <Text style={styles.detailValue}>{info.officeName}</Text>
                </View>
              )}
              {!!info?.windowName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Window</Text>
                  <Text style={styles.detailValue}>{info.windowName}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.okButton}
            onPress={handleOk}
            activeOpacity={0.85}
          >
            <Text style={styles.okText}>
              {isNext ? "OK — I'm Ready" : "OK — I'm Going"}
            </Text>
          </TouchableOpacity>
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
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.title,
    fontSize: 20,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  details: {
    width: '100%',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
  },
  detailValue: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: SPACING.sm,
  },
  okButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    width: '100%',
    ...SHADOWS.glow,
  },
  okText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
