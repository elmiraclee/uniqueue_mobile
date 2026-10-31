import CustomButton from "@/components/ui/custom-button";
import { clientAlert } from "@/components/client/client-ui";
import CustomInput from "@/components/ui/custom-input";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import AnimatedPressable from "../components/ui/animated-pressable";
import OtpInput from "../components/ui/otp-input";
import { API } from "@/constants/backend";
import { fetchJsonOrNull, safeFetchJson } from "@/utils/api";
import { COLORS, RADIUS } from "../constants/theme";

export default function ForgotPassword() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [masked, setMasked] = useState("");

  // Live "does this account exist?" check, same as the web form.
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "checking" | "found" | "notfound" | "invalid"
  >("idle");
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEmailShaped = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  /* Debounced lookup so we don't hit the server on every keystroke.
     The Send OTP button stays disabled until the email is confirmed. */
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);

    const value = email.trim().toLowerCase();
    if (!value) {
      setEmailStatus("idle");
      return;
    }
    if (!isEmailShaped(value)) {
      setEmailStatus("invalid");
      return;
    }

    setEmailStatus("checking");
    checkTimer.current = setTimeout(async () => {
      const res = await fetchJsonOrNull(API.forgotPassword, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_email", email: value }),
      });
      // If the check itself fails, don't block the user — let the server decide.
      if (!res) {
        setEmailStatus("idle");
        return;
      }
      setEmailStatus(res.found ? "found" : "notfound");
    }, 500);

    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [email]);

  const requestOtp = async () => {
    if (!email.trim()) {
      clientAlert("Email required");
      return;
    }
    if (emailStatus === "invalid") {
      clientAlert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (emailStatus === "notfound") {
      clientAlert(
        "No account found",
        "That email is not registered in UniQueue.",
      );
      return;
    }
    setLoading(true);
    try {
      // safeFetchJson (not fetchJsonOrNull) so a non-JSON/HTML reply from the
      // server surfaces the real reason instead of a bare "Failed".
      const result = await safeFetchJson(API.forgotPassword, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_otp",
          email: email.trim().toLowerCase(),
        }),
      });
      const res = result.data;

      if (res?.success) {
        setMasked(res.masked || email);
        setStep(2);
        clientAlert(
          "Check your email",
          res.message || "OTP sent if email is registered.",
        );
      } else {
        const detail =
          res?.debug ||
          result.error ||
          (result.raw
            ? `Server said: ${String(result.raw).slice(0, 300)}`
            : "");
        clientAlert(
          "Could not send code",
          [res?.message || "Failed", detail].filter(Boolean).join("\n\n"),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.forgotPassword, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          email: email.trim().toLowerCase(),
          otp,
        }),
      });
      if (res?.success) setStep(3);
      else clientAlert("Error", res?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // Same rules the server (and the web reset form) enforce.
  const passwordProblems = (pw: string) => {
    const errs: string[] = [];
    if (pw.length < 8) errs.push("At least 8 characters");
    if (!/[a-z]/.test(pw)) errs.push("One lowercase letter");
    if (!/[A-Z]/.test(pw)) errs.push("One uppercase letter");
    if (!/[0-9]/.test(pw)) errs.push("One number");
    if (!/[^a-zA-Z0-9]/.test(pw)) errs.push("One special character");
    return errs;
  };

  const resetPw = async () => {
    const problems = passwordProblems(password);
    if (problems.length) {
      clientAlert("Password too weak", problems.join("\n"));
      return;
    }
    if (password !== confirm) {
      clientAlert("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.forgotPassword, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          email: email.trim().toLowerCase(),
          otp,
          password,
        }),
      });
      if (res?.success) {
        clientAlert("Done", "Password updated. You can sign in now.", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
      } else {
        clientAlert("Error", res?.message || "Reset failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const canSend = !loading && emailStatus === "found";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.sub}>
          Student or parent account recovery via email OTP
        </Text>

        {step === 1 && (
          <>
            <Text style={styles.label}>Email</Text>
            <CustomInput
              style={[
                styles.input,
                emailStatus === "notfound" || emailStatus === "invalid"
                  ? styles.inputError
                  : emailStatus === "found"
                    ? styles.inputOk
                    : null,
                { marginBottom: 6 },
              ]}
              accessibilityLabel="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#b8adad"
            />

            <Text
              style={[
                styles.status,
                emailStatus === "found" && styles.statusOk,
                (emailStatus === "notfound" || emailStatus === "invalid") &&
                  styles.statusError,
              ]}
            >
              {emailStatus === "checking"
                ? "Checking…"
                : emailStatus === "found"
                  ? "✓ Account found"
                  : emailStatus === "notfound"
                    ? "✕ No account found with that email"
                    : emailStatus === "invalid"
                      ? "Enter a valid email address"
                      : " "}
            </Text>

            <CustomButton
              title="Send OTP"
              loading={loading}
              disabled={!canSend}
              onPress={requestOtp}
            />
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.sub}>
              We sent a 6-digit code to {masked || email}
            </Text>
            <Text style={styles.label}>Enter code</Text>
            <OtpInput value={otp} onChange={setOtp} length={6} />
            <CustomButton
              title="Verify OTP"
              loading={loading}
              disabled={loading || otp.length !== 6}
              onPress={verifyOtp}
            />
            <AnimatedPressable
              onPress={requestOtp}
              style={{ marginTop: 12, alignItems: "center" }}
              disabled={loading}
            >
              <Text style={{ color: COLORS.primary, fontWeight: "600" }}>
                Resend code
              </Text>
            </AnimatedPressable>
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.label}>New password</Text>
            <CustomInput
              style={styles.input}
              accessibilityLabel="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Text style={styles.hint}>
              Must have at least 8 characters, an uppercase and lowercase
              letter, a number, and a special character.
            </Text>
            <Text style={styles.label}>Confirm</Text>
            <CustomInput
              style={styles.input}
              accessibilityLabel="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
            <CustomButton
              title="Update password"
              loading={loading}
              disabled={loading}
              onPress={resetPw}
            />
          </>
        )}

        <AnimatedPressable
          onPress={() => router.back()}
          style={{ marginTop: 20, alignItems: "center" }}
        >
          <Text style={{ color: COLORS.primary, fontWeight: "600" }}>
            Back to login
          </Text>
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 24,
    paddingTop: 40,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: COLORS.text,
  },
  sub: {
    color: COLORS.gray,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    marginTop: 8,
  },
  label: { fontWeight: "600", marginBottom: 6 },
  hint: { color: COLORS.gray, fontSize: 14, marginTop: -6, marginBottom: 12 },
  status: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray,
    marginBottom: 10,
    minHeight: 16,
  },
  statusOk: { color: "#1E9E4F" },
  statusError: { color: "#D3453B" },
  inputOk: { borderColor: "#1E9E4F" },
  inputError: { borderColor: "#D3453B" },
  btnDisabled: { opacity: 0.5 },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#8793A4",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 52,
    marginBottom: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});
