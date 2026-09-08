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
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '../../constants/theme';

const PROCEED_ALARM = require('../../assets/sound/proceed_alarm.mp3');

export interface ProceedInfo {
  queueNumber?: string | null;
  officeName?: string | null;
  windowName?: string | null;
  status?: string | null;
}

interface Props {
  visible: boolean;
  info?: ProceedInfo | null;
  onAcknowledge: () => void;
}

/**
 * Blocking "Please Proceed Now" modal.
 * - Plays proceed_alarm.mp3 on a loop
 * - Vibrates repeatedly
 * - Does NOT dismiss until the user presses OK
 */
export default function ProceedModal({ visible, info, onAcknowledge }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const vibrateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startAlarm = async () => {
      if (!visible) return;

      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });

        // Unload any previous instance
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
          } catch {
            // ignore
          }
          soundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(PROCEED_ALARM, {
          isLooping: true,
          volume: 1.0,
          shouldPlay: true,
        });

        if (cancelled) {
          await sound.unloadAsync();
          return;
        }

        soundRef.current = sound;
        await sound.playAsync();
      } catch (err) {
        console.warn('Proceed alarm failed to start:', err);
      }

      // Vibration pattern: short pulses every ~1.2s while modal is open
      const pulse = () => {
        try {
          if (Platform.OS === 'android') {
            Vibration.vibrate([0, 400, 200, 400]);
          } else {
            Vibration.vibrate(400);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
              () => {}
            );
          }
        } catch {
          // ignore
        }
      };

      pulse();
      vibrateTimerRef.current = setInterval(pulse, 1200);
    };

    const stopAlarm = async () => {
      if (vibrateTimerRef.current) {
        clearInterval(vibrateTimerRef.current);
        vibrateTimerRef.current = null;
      }
      try {
        Vibration.cancel();
      } catch {
        // ignore
      }

      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch {
          // ignore
        }
        soundRef.current = null;
      }
    };

    if (visible) {
      startAlarm();
    } else {
      stopAlarm();
    }

    return () => {
      cancelled = true;
      stopAlarm();
    };
  }, [visible]);

  const handleOk = () => {
    onAcknowledge();
  };

  const status = (info?.status || '').toLowerCase();
  const subtitle =
    status === 'in_progress'
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
            <Ionicons name="notifications" size={36} color="#fff" />
          </View>

          <Text style={styles.title}>Please Proceed Now</Text>
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
            <Text style={styles.okText}>OK — I&apos;m Going</Text>
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
