import FeedbackPreferences from "@/components/ui/feedback-preferences";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "@/constants/theme";
import { ASSET_BASE_URL } from "@/constants/backend";
import {
  gradeChoices,
  SCHOOL_LEVELS,
  SchoolLevel,
  useGradeOptions,
} from "@/hooks/use-grade-options";
import { useClientUI } from "@/components/client/client-ui";
import { LegalLinks } from "@/components/legal-links";
import PasswordChecklist from "@/components/ui/password-checklist";
import { passwordError } from "@/utils/password";
import { logoutClient } from "@/utils/client-fetch";
import { uploadProfilePhoto } from "@/utils/profile-photo-upload";
import { usePortal } from "../portal/context";
import { request } from "../portal/api";
import { useResource } from "../portal/use-resource";
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
import Relationships from "./relationships";
type Form = {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  contact_number: string;
  school_level: SchoolLevel;
  grade_year: string;
  college_id: string;
  program_id: string;
};
const fromProfile = (v: any = {}): Form => ({
  first_name: v.first_name || "",
  last_name: v.last_name || "",
  full_name: v.full_name || "",
  email: v.email || "",
  contact_number: v.contact_number || "",
  school_level: v.school_level || "College",
  grade_year:
    v.grade_year ||
    (v.year_level
      ? `${["", "1st", "2nd", "3rd", "4th", "5th", "6th"][Number(v.year_level)] || v.year_level} Year`
      : ""),
  college_id: String(v.college_id || ""),
  program_id: String(v.program_id || ""),
});
function Select({
  label,
  value,
  options,
  onChange,
  enabled,
  readOnly = false,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  enabled: boolean;
  readOnly?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Copy>{label}</Copy>
      {readOnly ? (
        <Copy>
          {options.find((i) => i.value === value)?.label || value || "Not set"}
        </Copy>
      ) : (
        <View style={[s.input, { padding: 0 }]}>
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
            accessibilityLabel={label}
            enabled={enabled}
            selectedValue={value}
            onValueChange={(v) => onChange(String(v))}
          >
            <Picker.Item label={`Select ${label.toLowerCase()}`} value="" />
            {options.map((i) => (
              <Picker.Item key={i.value} label={i.label} value={i.value} />
            ))}
          </Picker>
        </View>
      )}
    </View>
  );
}
export default function ProfileScreen() {
  const size = useWindowDimensions();
  const [photoVisible, setPhotoVisible] = useState(false);
  const p = usePortal(),
    ui = useClientUI(),
    catalog = useGradeOptions(),
    [form, setForm] = useState<Form>(() => fromProfile(p.user)),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [photoFailed, setPhotoFailed] = useState(false),
    [programs, setPrograms] = useState<any[]>([]),
    [programError, setProgramError] = useState(""),
    [passwordOpen, setPasswordOpen] = useState(false),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    lock = useRef(false);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const profile = await request(
        p.role === "parent"
          ? "get_parent_profile.php"
          : `get_student_profile.php?student_id=${p.user.id}`,
        p.role === "parent" ? { parent_id: p.user.id } : undefined,
        signal,
      );
      const colleges =
        p.role === "student"
          ? await request("get_colleges.php", undefined, signal)
          : [];
      return {
        profile: p.role === "parent" ? profile.user : profile.student,
        colleges: Array.isArray(colleges) ? colleges : [],
      };
    },
    [p.role, p.user.id],
  );
  const r = useResource(load),
    profile = r.data?.profile;
  useEffect(() => {
    if (profile && !editing) setForm(fromProfile(profile));
  }, [profile, editing]);
  useEffect(() => {
    setPhotoFailed(false);
  }, [profile?.picture, profile?.google_picture]);
  const loadPrograms = useCallback(
    async (signal: AbortSignal) => {
      setProgramError("");
      if (!form.college_id) {
        setPrograms([]);
        return;
      }
      try {
        const data = await request(
          `get_programs.php?college_id=${form.college_id}`,
          undefined,
          signal,
        );
        if (!signal.aborted) setPrograms(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!signal.aborted) {
          setPrograms([]);
          setProgramError(
            e instanceof Error ? e.message : "Programs unavailable.",
          );
        }
      }
    },
    [form.college_id],
  );
  useEffect(() => {
    const abort = new AbortController();
    void loadPrograms(abort.signal);
    return () => abort.abort();
  }, [loadPrograms]);
  const patch = (value: Partial<Form>) =>
    setForm((old) => ({ ...old, ...value }));
  const save = async () => {
    if (lock.current || !profile || r.error) return;
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      return setError("Enter a valid email.");
    if (p.role === "parent") {
      if (!/^[a-zA-ZÑñ' -]{2,150}$/.test(form.full_name.trim()))
        return setError("Enter a valid parent / guardian name.");
      if (
        !/^(09\d{9}|\+?639\d{9})$/.test(
          form.contact_number.trim().replace(/[\s()-]/g, ""),
        )
      )
        return setError(
          "Enter a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX.",
        );
    } else {
      if (
        !/^[a-zA-ZÑñ' -]{1,50}$/.test(form.first_name.trim()) ||
        !/^[a-zA-ZÑñ' -]{1,50}$/.test(form.last_name.trim())
      )
        return setError("Enter valid first and last names.");
      if (
        catalog.loading ||
        catalog.error ||
        !gradeChoices(catalog.grades, form.school_level, {
          school: profile.school_level,
          value: profile.grade_year,
        }).some((g) => g.value === form.grade_year)
      )
        return setError("Load and choose a valid grade / year.");
      if (
        form.school_level === "College" &&
        (!form.college_id || !form.program_id || programError)
      )
        return setError("Select a valid college and program.");
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await request(
        p.role === "parent"
          ? "update_parent_profile.php"
          : "update_profile.php",
        p.role === "parent"
          ? {
              action: "update_details",
              parent_id: p.user.id,
              full_name: form.full_name.trim(),
              email: form.email.trim(),
              contact_number: form.contact_number.trim(),
            }
          : {
              student_id: p.user.id,
              first_name: form.first_name.trim(),
              last_name: form.last_name.trim(),
              email: form.email.trim(),
              school_level: form.school_level,
              grade_year: form.grade_year,
              college_id:
                form.school_level === "College"
                  ? Number(form.college_id)
                  : null,
              program_id:
                form.school_level === "College"
                  ? Number(form.program_id)
                  : null,
              grade_version: profile.grade_version,
            },
      );
      const next = data.user || data.student;
      if (!next)
        throw new Error(
          "The saved profile could not be read. Refresh to verify changes.",
        );
      await p.updateUser({ ...p.user, ...next });
      setEditing(false);
      await r.reload();
      ui.notify("Profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const pickPhoto = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw new Error("Allow photo library access to change your photo.");
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const data = await uploadProfilePhoto(result.assets[0]);
      await p.updateUser({ ...p.user, picture: data.picture });
      await r.reload();
      ui.notify("Photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo upload failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const changePassword = async () => {
    if (lock.current) return;
    const problem = passwordError(password);
    if (!current || problem || password !== confirm)
      return setError(
        !current
          ? "Enter your current password."
          : problem || "New passwords do not match.",
      );
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await request(
        p.role === "parent"
          ? "update_parent_profile.php"
          : "change_password.php",
        {
          ...(p.role === "parent"
            ? { action: "change_password", parent_id: p.user.id }
            : { student_id: p.user.id }),
          current_password: current,
          new_password: password,
          confirm_password: confirm,
        },
      );
      setCurrent("");
      setPassword("");
      setConfirm("");
      setPasswordOpen(false);
      ui.notify("Password updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change password.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const picture = profile?.picture || profile?.google_picture,
    photo = picture
      ? picture.startsWith("http")
        ? picture
        : `${ASSET_BASE_URL}/${picture}`
      : "";
  const choices = gradeChoices(
    catalog.grades,
    form.school_level,
    profile
      ? {
          school: profile.school_level,
          value: profile.grade_year || form.grade_year,
        }
      : undefined,
  );
  const colleges = (r.data?.colleges || []).map((c: any) => ({
      value: String(c.college_id),
      label: c.college_name,
    })),
    programOptions = programs.map((v: any) => ({
      value: String(v.program_id),
      label: v.program_name,
    }));
  if (
    profile?.college_id &&
    !colleges.some((c: any) => c.value === String(profile.college_id))
  )
    colleges.push({
      value: String(profile.college_id),
      label: (profile.college_name || "Current college") + " (current)",
    });
  if (
    profile?.program_id &&
    String(profile.college_id) === form.college_id &&
    !programOptions.some((c: any) => c.value === String(profile.program_id))
  )
    programOptions.push({
      value: String(profile.program_id),
      label: (profile.program_name || "Current program") + " (current)",
    });
  return (
    <Screen
      title="Your account"
      subtitle="Profile, security, and linked accounts."
      refreshing={r.loading}
      onRefresh={() => {
        if (!editing) void r.reload();
        void catalog.reload();
      }}
    >
      {r.error && <Notice message={r.error} retry={() => void r.reload()} />}
      {error && <Notice message={error} />}
      {r.loading && <ActivityIndicator color="#660810" />}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              p.role === "student" ? "View profile photo" : "Account profile"
            }
            disabled={p.role !== "student" || busy || !profile}
            onPress={() => setPhotoVisible(true)}
            style={{
              height: 72,
              width: 72,
              borderRadius: 36,
              backgroundColor: COLORS.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {p.role === "student" && photo && !photoFailed ? (
              <Image
                source={{ uri: photo }}
                accessibilityLabel="Profile photo"
                onError={() => setPhotoFailed(true)}
                style={{ height: 72, width: 72 }}
              />
            ) : (
              <Text
                style={{
                  fontSize: 24,
                  color: COLORS.primary,
                  fontWeight: "700",
                }}
              >
                {p.role === "student"
                  ? `${form.first_name[0] || ""}${form.last_name[0] || ""}`
                  : form.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
              </Text>
            )}
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontSize: 22,
                lineHeight: 28,
                letterSpacing: -0.5,
                fontWeight: "700",
                color: COLORS.text,
              }}
            >
              {profile?.full_name ||
                `${profile?.first_name || p.user.first_name || ""} ${profile?.last_name || p.user.last_name || ""}`}
            </Text>
            <Copy muted>
              {p.role === "student" ? profile?.sr_code : "Parent / Guardian"}
            </Copy>
            {p.role === "student" && (
              <Copy muted>
                {busy ? "Uploading photo…" : "Tap photo to view or change"}
              </Copy>
            )}
          </View>
        </View>
      </Card>
      <Card>
        <Heading>Personal details</Heading>
        {p.role === "parent" ? (
          <>
            <Field
              label="Full name"
              value={form.full_name}
              onChangeText={(full_name) => patch({ full_name })}
              editable={editing && !busy}
            />
            <Field
              label="Mobile number"
              value={form.contact_number}
              onChangeText={(contact_number) => patch({ contact_number })}
              keyboardType="phone-pad"
              editable={editing && !busy}
            />
          </>
        ) : (
          <>
            <Field
              label="First name"
              value={form.first_name}
              onChangeText={(first_name) => patch({ first_name })}
              editable={editing && !busy}
            />
            <Field
              label="Last name"
              value={form.last_name}
              onChangeText={(last_name) => patch({ last_name })}
              editable={editing && !busy}
            />
          </>
        )}
        <Field
          label="Email"
          value={form.email}
          onChangeText={(email) => patch({ email })}
          editable={editing && !busy}
          keyboardType="email-address"
        />
      </Card>
      {p.role === "student" && (
        <Card>
          <Heading>Academic details</Heading>
          {catalog.error && (
            <Notice
              message={catalog.error}
              retry={() => void catalog.reload()}
            />
          )}
          {programError && (
            <Notice
              message={programError}
              retry={() => void loadPrograms(new AbortController().signal)}
            />
          )}
          <Select
            readOnly={!editing}
            label="School level"
            value={form.school_level}
            options={SCHOOL_LEVELS}
            enabled={editing && !busy}
            onChange={(v) =>
              patch({
                school_level: v as SchoolLevel,
                grade_year: "",
                college_id: "",
                program_id: "",
              })
            }
          />
          <Select
            readOnly={!editing}
            label="Grade / year"
            value={form.grade_year}
            options={choices.map((g) => ({ value: g.value, label: g.label }))}
            enabled={editing && !busy && !catalog.loading}
            onChange={(grade_year) => patch({ grade_year })}
          />
          {form.school_level === "College" && (
            <>
              <Select
                readOnly={!editing}
                label="College"
                value={form.college_id}
                options={colleges}
                enabled={editing && !busy}
                onChange={(college_id) => patch({ college_id, program_id: "" })}
              />
              <Select
                readOnly={!editing}
                label="Program"
                value={form.program_id}
                options={programOptions}
                enabled={editing && !busy}
                onChange={(program_id) => patch({ program_id })}
              />
            </>
          )}
        </Card>
      )}
      {editing ? (
        <>
          <Button
            title="Save changes"
            loading={busy}
            disabled={!!r.error}
            onPress={() => void save()}
          />
          <Button
            title="Cancel editing"
            secondary
            disabled={busy}
            onPress={() => {
              setEditing(false);
              setForm(fromProfile(profile || p.user));
              setError("");
            }}
          />
        </>
      ) : (
        <Button
          title="Edit profile"
          secondary
          disabled={!profile || !!r.error}
          onPress={() => setEditing(true)}
        />
      )}
      <Card>
        <Heading>Account security</Heading>
        {passwordOpen ? (
          <>
            <Field
              label="Current password"
              secure
              value={current}
              onChangeText={setCurrent}
            />
            <Field
              label="New password"
              secure
              value={password}
              onChangeText={setPassword}
            />
            <PasswordChecklist password={password} />
            <Field
              label="Confirm new password"
              secure
              value={confirm}
              onChangeText={setConfirm}
            />
            <Button
              title="Save new password"
              loading={busy}
              onPress={() => void changePassword()}
            />
            <Button
              title="Cancel password change"
              secondary
              disabled={busy}
              onPress={() => {
                setPasswordOpen(false);
                setCurrent("");
                setPassword("");
                setConfirm("");
              }}
            />
          </>
        ) : (
          <Button
            title="Change password"
            secondary
            onPress={() => setPasswordOpen(true)}
          />
        )}
      </Card>
      <FeedbackPreferences />
      <Relationships />
      <Button
        title="Logout"
        secondary
        disabled={busy}
        onPress={() =>
          ui.confirm({
            title: "Logout from this device?",
            message:
              "Your account remains active. This device’s stored session and live-ticket widget will be cleared.",
            confirmLabel: "Logout",
            onConfirm: () => void logoutClient(),
          })
        }
      />
      <LegalLinks />
      <Modal
        visible={photoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,.65)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 480,
              alignSelf: "center",
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              gap: 16,
            }}
          >
            <Heading>Profile photo</Heading>
            {photo && !photoFailed ? (
              <Image
                accessibilityLabel="Current profile photo"
                source={{ uri: photo }}
                onError={() => setPhotoFailed(true)}
                style={{
                  height: Math.min(260, size.height * 0.25),
                  width: "100%",
                }}
                resizeMode="contain"
              />
            ) : (
              <Copy muted>
                {photoFailed
                  ? "Photo could not load. You can choose a new one."
                  : "No profile photo yet."}
              </Copy>
            )}
            <Button
              title="Change profile photo"
              disabled={busy || !profile || !!r.error}
              onPress={() => {
                setPhotoVisible(false);
                void pickPhoto();
              }}
            />
            <Button
              title="Close photo"
              secondary
              onPress={() => setPhotoVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
