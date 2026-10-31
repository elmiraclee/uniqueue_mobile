import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { router } from "expo-router";
import { useClientUI } from "@/components/client/client-ui";
import { gradeChoices, useGradeOptions } from "@/hooks/use-grade-options";
import { usePortal } from "../portal/context";
import { request } from "../portal/api";
import {
  Button,
  Card,
  Copy,
  Field,
  Heading,
  Notice,
  Screen,
  s,
} from "../portal/ui";
export default function AddChildScreen() {
  const p = usePortal(),
    ui = useClientUI(),
    catalog = useGradeOptions(),
    [mode, setMode] = useState<"create" | "link">("create"),
    [first, setFirst] = useState(""),
    [last, setLast] = useState(""),
    [sr, setSr] = useState(""),
    [grade, setGrade] = useState(""),
    [relationship, setRelationship] = useState("Parent/Guardian"),
    [check, setCheck] = useState<any>(null),
    [checking, setChecking] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    serial = useRef(0),
    lock = useRef(false);
  const values = {
      mode,
      first_name: first.trim(),
      last_name: last.trim(),
      sr_code: sr.trim(),
      grade_year: grade,
      relationship,
    },
    key = JSON.stringify(values),
    valid =
      /^[A-Za-zÑñ' -]{1,50}$/.test(values.first_name) &&
      /^[A-Za-zÑñ' -]{1,50}$/.test(values.last_name) &&
      /^\d{2}-\d{5}$/.test(values.sr_code) &&
      (mode === "link" || !!grade);
  useEffect(() => {
    const n = ++serial.current,
      abort = new AbortController();
    setCheck(null);
    setChecking(valid);
    if (!valid) return;
    const timer = setTimeout(() => {
      void request("parent_check_child.php", JSON.parse(key), abort.signal)
        .then((data) => {
          if (n === serial.current)
            setCheck({ ...data, state: data.allowed ? "valid" : "invalid" });
        })
        .catch(() => {
          if (n === serial.current && !abort.signal.aborted)
            setCheck({
              state: "unavailable",
              message:
                "Live check could not finish. Submit for final server validation, or check again.",
            });
        })
        .finally(() => {
          if (n === serial.current) setChecking(false);
        });
    }, 500);
    return () => {
      serial.current++;
      clearTimeout(timer);
      abort.abort();
    };
  }, [key, valid, retry]);
  const submit = async () => {
    if (
      lock.current ||
      !valid ||
      checking ||
      !check ||
      check.state === "invalid"
    )
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request("parent_add_child.php", values);
      await p.reloadChildren();
      ui.success({
        title: data.mode === "request" ? "Approval requested" : "Child linked",
        message: data.message || "Your children list has been updated.",
        confirmLabel: "Return to Home",
        onConfirm: () => router.replace("/parent/home"),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Check Home before retrying.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Add / link child"
      subtitle="Use the student’s exact school-record details."
      back
    >
      <Card>
        <View style={s.row}>
          <Button
            title="Add child"
            secondary={mode !== "create"}
            disabled={busy}
            onPress={() => setMode("create")}
          />
          <Button
            title="Link existing"
            secondary={mode !== "link"}
            disabled={busy}
            onPress={() => setMode("link")}
          />
        </View>
        <Copy>
          {mode === "create"
            ? "Create a parent-managed Elementary profile. If the student already has a profile, use Link existing."
            : "Activated accounts at every school level require student approval. Profile-only accounts may link immediately after matching."}
        </Copy>
      </Card>
      {error && <Notice message={error} />}
      <Card>
        <Heading>Student details</Heading>
        <Field
          label="First name"
          value={first}
          onChangeText={setFirst}
          editable={!busy}
        />
        <Field
          label="Last name"
          value={last}
          onChangeText={setLast}
          editable={!busy}
        />
        <Field
          label="SR Code · YY-NNNNN"
          value={sr}
          editable={!busy}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, 7);
            setSr(
              digits.length > 2
                ? digits.slice(0, 2) + "-" + digits.slice(2)
                : digits,
            );
          }}
        />
        {mode === "create" && (
          <>
            <Copy>Elementary grade</Copy>
            {catalog.error && (
              <Notice
                message={catalog.error}
                retry={() => void catalog.reload()}
              />
            )}
            <View style={s.input}>
              <Picker
                style={
                  Platform.OS === "web"
                    ? {
                        fontSize: 16,
                        height: 48,
                        width: "100%",
                        borderWidth: 0,
                        backgroundColor: "transparent",
                      }
                    : undefined
                }
                accessibilityLabel="Elementary grade"
                selectedValue={grade}
                enabled={!busy && !catalog.loading}
                onValueChange={setGrade}
              >
                <Picker.Item label="Choose grade" value="" />
                {gradeChoices(catalog.grades, "Elementary").map((g) => (
                  <Picker.Item key={g.value} label={g.label} value={g.value} />
                ))}
              </Picker>
            </View>
          </>
        )}
        <Copy>Relationship</Copy>
        <View style={s.input}>
          <Picker
            style={
              Platform.OS === "web"
                ? {
                    fontSize: 16,
                    height: 48,
                    width: "100%",
                    borderWidth: 0,
                    backgroundColor: "transparent",
                  }
                : undefined
            }
            accessibilityLabel="Relationship"
            selectedValue={relationship}
            enabled={!busy}
            onValueChange={setRelationship}
          >
            {["Parent/Guardian", "Mother", "Father", "Parent", "Guardian"].map(
              (v) => (
                <Picker.Item key={v} value={v} label={v} />
              ),
            )}
          </Picker>
        </View>
        {checking ? (
          <ActivityIndicator />
        ) : check ? (
          <Copy>{check.message}</Copy>
        ) : (
          <Copy muted>Complete the required details for live matching.</Copy>
        )}
        {check?.next_mode && (
          <Button
            title={
              check.next_mode === "link"
                ? "Switch to Link existing"
                : "Switch to Add child"
            }
            secondary
            onPress={() =>
              setMode(check.next_mode === "link" ? "link" : "create")
            }
          />
        )}
        <Copy muted>
          A match does not prove guardianship or create a link. Final submission
          always revalidates these details.
        </Copy>
        <Button
          title="Check again"
          secondary
          disabled={!valid || checking || busy}
          onPress={() => setRetry((v) => v + 1)}
        />
        <Button
          title={mode === "create" ? "Add child" : "Link / request approval"}
          loading={busy}
          disabled={
            !valid ||
            checking ||
            !check ||
            check.state === "invalid" ||
            (mode === "create" && (catalog.loading || !!catalog.error))
          }
          onPress={() => void submit()}
        />
      </Card>
    </Screen>
  );
}
