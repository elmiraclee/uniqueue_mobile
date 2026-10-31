import { useReducedMotion } from "@/hooks/use-reduced-motion";
import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
} from "react";
import type { AlertButton } from "react-native";
import {
  Modal,
  Pressable,
  Text,
  View,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomButton from "../ui/custom-button";
import { COLORS } from "@/constants/theme";
import {
  disposeFeedbackAudio,
  loadFeedbackPreferences,
  playFeedback,
} from "@/utils/ui-feedback";
type Dialog = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  success?: boolean;
  onConfirm?: () => void;
  cancel?: boolean;
  cancelLabel?: string;
  onCancel?: () => void;
  extra?: AlertButton[];
};
type UI = {
  notify: (message: string, kind?: "success" | "error") => void;
  confirm: (dialog: Dialog) => void;
  success: (dialog: Dialog) => void;
};
let showAlert:
  | ((title: string, message?: string, buttons?: AlertButton[]) => void)
  | null = null;
export function clientAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  _options?: unknown,
) {
  showAlert?.(title, message, buttons);
}
const Context = createContext<UI>({
  notify: () => {},
  confirm: () => {},
  success: () => {},
});
export const useClientUI = () => useContext(Context);
export function ClientUIProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: string } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const closeDialog = () => {
    const previous = dialog;
    setDialog(null);
    previous?.onCancel?.();
  };
  useEffect(() => {
    void loadFeedbackPreferences();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      disposeFeedbackAudio();
    };
  }, []);
  useEffect(() => {
    if (dialog)
      void playFeedback(
        dialog.danger ? "error" : dialog.success ? "success" : "tap",
      );
  }, [dialog]);
  useEffect(() => {
    showAlert = (title, message, buttons) => {
      const list = buttons?.length ? buttons : [{ text: "OK" }];
      const cancel = list.find((b) => b.style === "cancel");
      const actions = list.filter((b) => b !== cancel);
      const primary = actions[actions.length - 1] || cancel;
      setDialog({
        title,
        message: message || "",
        confirmLabel: primary?.text || "OK",
        onConfirm: primary?.onPress
          ? () => {
              primary.onPress?.();
            }
          : undefined,
        cancel: !!cancel && primary !== cancel,
        cancelLabel: cancel?.text,
        onCancel: cancel?.onPress
          ? () => {
              cancel.onPress?.();
            }
          : undefined,
        danger: primary?.style === "destructive",
        success: /success|created|updated|saved|sent/i.test(title),
        extra: actions.slice(0, -1),
      });
    };
    return () => {
      showAlert = null;
    };
  }, []);
  const notify: UI["notify"] = (message, kind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    void playFeedback(kind);
    timer.current = setTimeout(() => setToast(null), 6000);
  };
  return (
    <Context.Provider
      value={{
        notify,
        confirm: (d) => setDialog({ ...d, cancel: true }),
        success: (d) => setDialog({ ...d, success: true }),
      }}
    >
      {children}
      {toast && (
        <View
          style={[
            s.toast,
            {
              bottom: Math.max(insets.bottom, 16) + 88,
              borderLeftColor:
                toast.kind === "error" ? COLORS.danger : COLORS.success,
            },
          ]}
          accessibilityLiveRegion={
            toast.kind === "error" ? "assertive" : "polite"
          }
        >
          <Ionicons
            name={
              toast.kind === "error"
                ? "alert-circle-outline"
                : "checkmark-circle-outline"
            }
            size={24}
            color={toast.kind === "error" ? COLORS.danger : COLORS.success}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.toastTitle}>
              {toast.kind === "error" ? "Something went wrong" : "Done"}
            </Text>
            <Text style={s.toastText}>{toast.message}</Text>
          </View>
          <Pressable
            accessibilityLabel="Dismiss notification"
            accessibilityRole="button"
            onPress={() => setToast(null)}
            style={s.close}
          >
            <Ionicons name="close" size={20} color={COLORS.gray} />
          </Pressable>
        </View>
      )}
      <Modal
        visible={!!dialog}
        transparent
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={closeDialog}
      >
        <View style={s.overlay}>
          <View style={s.card} accessibilityViewIsModal>
            <ScrollView
              contentContainerStyle={{ padding: 24, gap: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              <View
                style={[
                  s.symbol,
                  {
                    backgroundColor: dialog?.danger
                      ? COLORS.dangerLight
                      : dialog?.success
                        ? COLORS.successLight
                        : COLORS.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name={
                    dialog?.danger
                      ? "alert-circle-outline"
                      : dialog?.success
                        ? "checkmark-circle-outline"
                        : "help-circle-outline"
                  }
                  size={32}
                  color={
                    dialog?.danger
                      ? COLORS.danger
                      : dialog?.success
                        ? COLORS.success
                        : COLORS.primary
                  }
                />
              </View>
              <Text accessibilityRole="header" style={s.title}>
                {dialog?.title}
              </Text>
              {!!dialog?.message && (
                <Text style={s.message}>{dialog.message}</Text>
              )}
              {dialog?.extra?.map((button, i) => (
                <CustomButton
                  key={i}
                  title={button.text || "Continue"}
                  outlined
                  onPress={() => {
                    setDialog(null);
                    button.onPress?.();
                  }}
                />
              ))}
              <CustomButton
                title={dialog?.confirmLabel || "Continue"}
                danger={dialog?.danger}
                onPress={() => {
                  const fn = dialog?.onConfirm;
                  setDialog(null);
                  fn?.();
                }}
              />
              {dialog?.cancel && (
                <CustomButton
                  title={dialog.cancelLabel || "Cancel"}
                  outlined
                  onPress={closeDialog}
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Context.Provider>
  );
}
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    maxHeight: "85%",
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.gray,
    textAlign: "center",
  },
  symbol: {
    width: 64,
    height: 64,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    width: "92%",
    maxWidth: 540,
    zIndex: 1000,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    padding: 12,
    gap: 12,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      web: { boxShadow: "0 4px 20px rgba(0,0,0,.10)" },
      default: { elevation: 8 },
    }),
  },
  toastTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
    fontWeight: "700",
  },
  toastText: { color: COLORS.text, fontSize: 16, lineHeight: 22 },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
