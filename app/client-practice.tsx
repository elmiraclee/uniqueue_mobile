/** Isolated practice: shared form presentation, never a queue or feedback API write. */
import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  TourTarget,
  TutorialScrollView,
  useTutorial,
} from "@/components/tutorial/tutorial";
import {
  QueueTypeCards,
  ServiceRequestCard,
  FormProgress,
  AcademicCopy,
  f,
} from "@/components/queue-step/form-ui";
import QueueDetailsCard from "@/components/queue/queue-details-card";
import QueueServiceItemsList from "@/components/queue/queue-service-items-list";
import CSMForm from "@/components/feedback/csm-form";
import CustomButton from "@/components/ui/custom-button";
import { COLORS } from "@/constants/theme";
const item = {
  id: 1,
  name: "Document Request (example)",
  category: "Documents",
  amount: 100,
  pay_at_cashier: true,
  use_academic_period: true,
  choices: [],
};
const requirements = [
  "School ID (example)",
  "Completed request form (example)",
];
const periods = ["First Semester", "Second Semester"].map((value) => ({
  value,
  label: value,
}));
const years = ["2026-2027", "2025-2026"].map((value) => ({
  value,
  label: value,
}));
export default function ClientPractice() {
  const params = useLocalSearchParams<{ phase?: string }>(),
    guide = useTutorial(),
    insets = useSafeAreaInsets(),
    windowSize = useWindowDimensions();
  const phase = params.phase || "type";
  const [queueType, setQueueType] = useState<"walkin" | "appointment">(
    "walkin",
  );
  const [selected, setSelected] = useState(false),
    [quantity, setQuantity] = useState(1),
    [rows, setRows] = useState<AcademicCopy[]>([]),
    [same, setSame] = useState(true),
    [checked, setChecked] = useState<string[]>([]),
    [created, setCreated] = useState(false);
  useEffect(() => {
    setQueueType("walkin");
    setSelected(false);
    setQuantity(1);
    setRows([]);
    setSame(true);
    setChecked([]);
    setCreated(false);
  }, [guide.runId]);
  // Resuming at a later lesson restores prerequisites, not completion of its action.
  useEffect(() => {
    const action = guide.step?.action;
    if (phase === "academic" || action === "quantity")
      setSelected(true);
    if (phase === "academic") {
      setQuantity((q) => Math.max(2, q));
    }
    if (["requirements", "review", "ticket"].includes(phase)) {
      setSelected(true);
      setQuantity((q) => Math.max(2, q));
      setRows((old) =>
        Array.from({ length: Math.max(2, old.length) }, (_, i) => ({
          period: old[i]?.period || "First Semester",
          school_year: old[i]?.school_year || "2026-2027",
        })),
      );
    }
  }, [phase, guide.step?.action, guide.runId]);
  const exit = () => {
    guide.pause();
    router.replace(guide.role === "parent" ? "/parent/home" : "/student/home");
  };
  const ticket = {
    queue_number: "R-EXAMPLE",
    office_name: "Registrar (example)",
    status: "waiting",
    type: queueType,
    people_ahead: 3,
    joined_at: "2026-10-31T09:00:00+08:00",
    window_name: "Window 1 (example)",
  };
  const step =
    phase === "type"
      ? 0
      : ["services", "academic"].includes(phase)
        ? 1
        : phase === "requirements"
          ? 2
          : 3;
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit queue practice"
          onPress={exit}
          style={s.icon}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={f.heading}>Queue practice</Text>
          <Text style={f.meta}>Safe demo · no real transactions</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Resume tutorial"
          onPress={guide.show}
          style={s.icon}
        >
          <Ionicons
            name="help-circle-outline"
            size={24}
            color={COLORS.primary}
          />
        </Pressable>
      </View>
      <TutorialScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: guide.visible
            ? windowSize.height
            : Math.max(32, insets.bottom + 24),
          gap: 16,
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.banner}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={COLORS.primary}
          />
          <Text style={[f.meta, { flex: 1, color: COLORS.primary }]}>
            Try the real form controls with sample data. Nothing here creates a
            ticket, payment or feedback response.
          </Text>
        </View>
        {["type", "services", "academic", "requirements", "review"].includes(
          phase,
        ) && (
          <FormProgress
            practice
            labels={[
              "Queue type",
              "Service details",
              "Requirements",
              "Review & confirm",
            ]}
            current={step}
          />
        )}
        {phase === "type" && (
          <TourTarget id="queue-type">
            <QueueTypeCards
              value={queueType}
              onChange={(value) => {
                setQueueType(value);
                guide.completeAction("queue-type");
              }}
            />
          </TourTarget>
        )}
        {["services", "academic"].includes(phase) && (
          <ServiceRequestCard
            item={item}
            selected={selected}
            onToggle={() => {
              setSelected((v) => !v);
              if (!selected) guide.completeAction("service");
            }}
            quantity={quantity}
            onQuantity={(value) => {
              setQuantity(value);
              setRows((old) =>
                Array.from(
                  { length: value },
                  (_, i) =>
                    old[same ? 0 : i] || { period: "", school_year: "" },
                ),
              );
              if (value >= 2) guide.completeAction("quantity");
            }}
            optionId={0}
            onOption={() => {}}
            rows={rows}
            onAcademic={(next) => {
              setRows(next);
              if (next.every((r) => !!r.period)) guide.completeAction("period");
              if (next.every((r) => !!r.school_year))
                guide.completeAction("year");
            }}
            periods={periods}
            years={years}
            sameForAll={same}
            onSameForAll={setSame}
          />
        )}
        {phase === "requirements" && (
          <View style={s.card}>
            <Text style={f.heading}>Prepare your requirements</Text>
            <Text style={f.copy}>
              Bring these sample documents to the counter.
            </Text>
            <TourTarget id="requirements">
              <View style={{ gap: 12 }}>
                {requirements.map((label) => (
                  <Pressable
                    key={label}
                    accessibilityRole="checkbox"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: checked.includes(label) }}
                    onPress={() => {
                      const next = checked.includes(label)
                        ? checked.filter((x) => x !== label)
                        : [...checked, label];
                      setChecked(next);
                      if (next.length === requirements.length)
                        guide.completeAction("requirements");
                    }}
                    style={[s.check, checked.includes(label) && s.selected]}
                  >
                    <Ionicons
                      name={
                        checked.includes(label) ? "checkbox" : "square-outline"
                      }
                      size={24}
                      color={COLORS.primary}
                    />
                    <Text style={[f.label, { flex: 1 }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </TourTarget>
          </View>
        )}
        {phase === "review" && (
          <>
            <TourTarget id="review-summary">
              <View style={s.card}>
                <Text style={f.heading}>Review your practice request</Text>
                <Text style={f.copy}>
                  Registrar ·{" "}
                  {queueType === "walkin" ? "Walk-in" : "Appointment"}
                </Text>
                <Text style={f.title}>
                  {item.name} × {quantity}
                </Text>
                {rows.map((row, i) => (
                  <Text key={i} style={f.meta}>
                    Copy {i + 1}: {row.period} · {row.school_year}
                  </Text>
                ))}
                <View style={s.total}>
                  <Text style={f.label}>Estimated total</Text>
                  <Text style={f.heading}>₱{(quantity * 100).toFixed(2)}</Text>
                </View>
                <Text style={f.meta}>Example only · no payment is taken.</Text>
              </View>
            </TourTarget>
            <TourTarget id="review-action">
              <View style={{ gap: 12 }}>
                <CustomButton
                  title={
                    created
                      ? "Practice ticket created"
                      : "Create practice ticket"
                  }
                  onPress={() => {
                    setCreated(true);
                    guide.completeAction("review");
                  }}
                />
                {created && (
                  <Text accessibilityRole="alert" style={s.success}>
                    ✓ Sample ticket is ready. Tap Next to view it.
                  </Text>
                )}
              </View>
            </TourTarget>
          </>
        )}
        {phase === "ticket" && (
          <>
            <TourTarget id="ticket">
              <QueueDetailsCard queue={ticket} />
            </TourTarget>
            <QueueServiceItemsList
              service_items={[
                {
                  name: item.name,
                  quantity,
                },
              ]}
            />
            <Text style={f.meta}>
              Sample ticket only. No live queue was joined.
            </Text>
          </>
        )}
        {phase === "csm" && (
          <CSMForm
            office="Registrar (example)"
            service={item.name}
            practice
            onSubmit={() => {}}
          />
        )}
        {!guide.visible && (
          <CustomButton
            title="Resume guided walkthrough"
            onPress={guide.show}
          />
        )}
        <CustomButton title="Exit practice" outlined onPress={exit} />
      </TutorialScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    gap: 12,
  },
  check: {
    minHeight: 56,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  total: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  success: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.success,
    padding: 12,
    backgroundColor: COLORS.successLight,
    borderRadius: 8,
  },
});
