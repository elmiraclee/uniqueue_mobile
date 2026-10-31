import { SafeAreaView } from "react-native-safe-area-context";
import { clientAlert } from "@/components/client/client-ui";
import CustomInput from "@/components/ui/custom-input";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { API } from "@/constants/backend";
import { fetchJsonOrNull } from "@/utils/api";
import { passwordError } from "@/utils/password";
import { registerPushToken } from "@/components/notification/push";
import CustomButton from "@/components/ui/custom-button";
import PasswordChecklist from "@/components/ui/password-checklist";
import { COLORS } from "@/constants/theme";
export default function ActivateAccount() {
  const [step, setStep] = useState<"identity" | "otp" | "password">("identity");
  const [first, setFirst] = useState(""),
    [last, setLast] = useState(""),
    [sr, setSr] = useState("");
  const [otp, setOtp] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState("");
  const [challenge, setChallenge] = useState(""),
    [verification, setVerification] = useState("");
  const [masked, setMasked] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [resendAt, setResendAt] = useState(0);
  const reset = () => {
    setStep("identity");
    setChallenge("");
    setVerification("");
    setOtp("");
    setPassword("");
    setConfirm("");
    setMessage("");
  };
  async function send(action: "request_otp" | "verify_otp" | "activate") {
    if (busy) return;
    if (!/^\d{2}-\d{5}$/.test(sr.trim()))
      return clientAlert("SR Code", "Use YY-NNNNN.");
    if (
      !/^[A-Za-zÑñ' -]{1,50}$/.test(first.trim()) ||
      !/^[A-Za-zÑñ' -]{1,50}$/.test(last.trim())
    )
      return clientAlert("Name", "Enter your official first and last name.");
    if (action === "request_otp" && Date.now() < resendAt)
      return clientAlert(
        "Please wait",
        "Wait 60 seconds between activation codes.",
      );
    if (action === "verify_otp" && !/^\d{6}$/.test(otp))
      return clientAlert("Activation code", "Enter the 6-digit code.");
    if (action === "activate") {
      const error = passwordError(password);
      if (error) return clientAlert("Password", error);
      if (password !== confirm)
        return clientAlert("Password", "Passwords do not match.");
    }
    setBusy(true);
    try {
      const data = await fetchJsonOrNull(API.activateStudent, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          first_name: first.trim(),
          last_name: last.trim(),
          sr_code: sr.trim(),
          challenge,
          otp,
          verification_token: verification,
          ...(action === "activate"
            ? { password, confirm_password: confirm }
            : {}),
        }),
      });
      setMessage(
        data?.message ||
          "Request could not finish. If password creation was submitted, try Student Login before starting over.",
      );
      if (!data?.success) {
        if (data?.next_action === "signup" || data?.next_action === "login")
          clientAlert("Student account", data.message, [
            { text: "Stay", style: "cancel" },
            {
              text:
                data.next_action === "signup"
                  ? "Student Sign Up"
                  : "Student Login",
              onPress: () =>
                router.replace(
                  data.next_action === "signup" ? "/signup" : "/login",
                ),
            },
          ]);
        return;
      }
      if (data.step === "otp") {
        setChallenge(data.challenge);
        setVerification("");
        setMasked(data.masked_email);
        setOtp("");
        setResendAt(Date.now() + 60000);
        setStep("otp");
      }
      if (data.step === "password") {
        setVerification(data.verification_token);
        setOtp("");
        setStep("password");
      }
      if (data.step === "complete") {
        setPassword("");
        setConfirm("");
        setChallenge("");
        setVerification("");
        await AsyncStorage.removeItem("google_pending");
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        await AsyncStorage.setItem("role", "student");
        const id = Number(data.user?.id || 0);
        if (id)
          await registerPushToken({ role: "student", id }).catch(() => {});
        clientAlert("Account activated", data.message, [
          {
            text: "Update profile",
            onPress: () => router.replace("/student/profile"),
          },
        ]);
      }
    } catch {
      setMessage(
        "Connection failed. If activation was submitted, try Student Login before requesting another code.",
      );
    } finally {
      setBusy(false);
    }
  }
  const formatSR = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 7);
    setSr(d.length > 2 ? d.slice(0, 2) + "-" + d.slice(2) : d);
  };
  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.title}>Activate Student Account</Text>
          <Text style={s.copy}>
            Activate an existing parent-managed profile. Verify your student
            GSuite email first, then create your password. Your current school
            details stay unchanged until you update your profile.
          </Text>
          <Text style={s.label}>Last name</Text>
          <CustomInput
            style={s.input}
            accessibilityLabel="Last name"
            value={last}
            onChangeText={setLast}
            editable={step === "identity" && !busy}
            maxLength={50}
          />
          <Text style={s.label}>First name</Text>
          <CustomInput
            style={s.input}
            accessibilityLabel="First name"
            value={first}
            onChangeText={setFirst}
            editable={step === "identity" && !busy}
            maxLength={50}
          />
          <Text style={s.label}>SR Code</Text>
          <CustomInput
            style={s.input}
            accessibilityLabel="SR Code"
            value={sr}
            onChangeText={formatSR}
            editable={step === "identity" && !busy}
            keyboardType="number-pad"
            placeholder="YY-NNNNN"
            maxLength={8}
          />
          <Text style={s.copy}>
            OTP destination:{" "}
            {step === "identity"
              ? "your SR Code + @g.batstate-u.edu.ph"
              : masked}
          </Text>
          {step === "otp" && (
            <>
              <Text style={s.label}>6-digit activation code</Text>
              <CustomInput
                style={s.input}
                accessibilityLabel="6-digit activation code"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                editable={!busy}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <CustomButton
                title="Resend code (60-second cooldown)"
                outlined
                disabled={busy}
                onPress={() => void send("request_otp")}
              />
            </>
          )}
          {step === "password" && (
            <>
              <Text style={s.label}>Password</Text>
              <CustomInput
                style={s.input}
                accessibilityLabel="Password"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                secureTextEntry
                autoComplete="new-password"
                maxLength={72}
              />
              <Text style={s.label}>Confirm password</Text>
              <CustomInput
                style={s.input}
                accessibilityLabel="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                editable={!busy}
                secureTextEntry
                autoComplete="new-password"
                maxLength={72}
              />
              <PasswordChecklist password={password} confirm={confirm} />
            </>
          )}
          {!!message && (
            <Text style={s.copy} accessibilityLiveRegion="polite">
              {message}
            </Text>
          )}
          <CustomButton
            title={
              step === "identity"
                ? "Send activation code"
                : step === "otp"
                  ? "Verify code"
                  : "Create password and activate"
            }
            loading={busy}
            disabled={busy}
            onPress={() =>
              void send(
                step === "identity"
                  ? "request_otp"
                  : step === "otp"
                    ? "verify_otp"
                    : "activate",
              )
            }
          />
          {step !== "identity" && (
            <CustomButton
              title="Change details / start over"
              outlined
              disabled={busy}
              onPress={reset}
            />
          )}
          <CustomButton
            title="Student Sign Up"
            outlined
            disabled={busy}
            onPress={() => router.replace("/signup")}
          />
          <CustomButton
            title="Student Login"
            outlined
            disabled={busy}
            onPress={() => router.replace("/login")}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  body: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    padding: 24,
    gap: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: COLORS.text,
  },
  copy: { fontSize: 16, lineHeight: 24, color: COLORS.gray },
  label: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  input: {
    marginBottom: 0,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#858D9A",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "white",
    fontSize: 16,
  },
});
