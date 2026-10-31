import CustomButton from "@/components/ui/custom-button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  stopQueueAlarm,
  holdQueueVibration,
  releaseQueueVibration,
} from "@/utils/queue-alerts";
import { useEffect } from "react";
import {
  AppState,
  Modal,
  StyleSheet,
  Text,
  ScrollView,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS, SHADOWS, SPACING, TYPOGRAPHY } from "../../constants/theme";

/*
| The event-ID based queue-alert owner handles foreground audio/vibration.
| Background local notifications use OS channels, subject to OS permissions,
| DND, battery restrictions and background delivery. The visible modal owns
| repeating foreground vibration; OK/unmount stops the shared alarm.
*/
export interface ProceedInfo {
  queueNumber?: string | null;
  officeName?: string | null;
  windowName?: string | null;
  status?: string | null;
  peopleAhead?: number | null;
}

/**
 * 'next'    -> the student is next in line (get ready)
 * 'proceed' -> the student is being called / served (go now)
 */
export type ProceedKind = "countdown" | "next" | "proceed";

interface Props {
  visible: boolean;
  info?: ProceedInfo | null;
  kind?: ProceedKind;
  onAcknowledge: () => void;
  vibrationKey?: string;
}

/**
 * Blocking alert modal.
 * - Owns repeating foreground vibration; audio uses the shared cue helper
 * - Does NOT dismiss until the user presses OK
 */
export default function ProceedModal({
  visible,
  info,
  kind = "proceed",
  onAcknowledge,
  vibrationKey,
}: Props) {
  const reducedMotion = useReducedMotion();
  useEffect(() => () => stopQueueAlarm(), []);
  useEffect(() => {
    if (!visible) return;
    const owner = vibrationKey || "visible-queue-prompt";
    const sync = (state: string | null | undefined) =>
      state === "active"
        ? holdQueueVibration(owner)
        : releaseQueueVibration(owner);
    sync(AppState.currentState);
    const sub = AppState.addEventListener("change", sync);
    return () => {
      sub.remove();
      releaseQueueVibration(owner);
    };
  }, [visible, vibrationKey]);

  const handleOk = () => {
    onAcknowledge();
  };

  const status = (info?.status || "").toLowerCase();
  const isNext = kind === "next",
    isCountdown = kind === "countdown";
  const ahead = Number(info?.peopleAhead);
  const title = isCountdown
    ? `${ahead} ${ahead === 1 ? "person" : "people"} ahead`
    : isNext
      ? "You're Next in Line"
      : "Please Proceed Now";
  const subtitle = isCountdown
    ? "Your turn is getting closer. Stay nearby and keep an eye on your ticket."
    : isNext
      ? "Get ready and stay near the window — you will be called next."
      : status === "in_progress"
        ? "You are being served — please go to the window."
        : "Please proceed to the window now.";

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? "none" : "fade"}
      transparent
      // Block Android back button — only OK dismisses
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.modal} accessibilityViewIsModal>
          <ScrollView
            contentContainerStyle={{ alignItems: "center" }}
            style={{ width: "100%" }}
          >
            <View style={styles.iconWrap}>
              {isCountdown ? (
                <Text
                  style={{
                    fontSize: 32,
                    lineHeight: 40,
                    fontWeight: "700",
                    color: "#fff",
                  }}
                >
                  {ahead}
                </Text>
              ) : (
                <Ionicons
                  name={isNext ? "alert-circle" : "notifications"}
                  size={36}
                  color="#fff"
                />
              )}
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

            <Text
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: COLORS.gray,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              Tap OK to acknowledge this alert.
            </Text>
            <View style={{ width: "100%" }}>
              <CustomButton
                title={
                  isCountdown
                    ? "OK — Got It"
                    : isNext
                      ? "OK — I'm Ready"
                      : "OK — I'm Going"
                }
                onPress={handleOk}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.overlay,
    padding: SPACING.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    ...SHADOWS.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.5,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 16,
    color: COLORS.gray,
    textAlign: "center",
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  details: {
    width: "100%",
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray,
  },
  detailValue: {
    ...TYPOGRAPHY.bodyStrong,
    color: COLORS.text,
    flexShrink: 1,
    textAlign: "right",
    marginLeft: SPACING.sm,
  },
});
