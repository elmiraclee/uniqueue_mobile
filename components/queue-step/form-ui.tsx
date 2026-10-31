import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { COLORS } from "@/constants/theme";
import { TourTarget } from "@/components/tutorial/tutorial";
import CustomButton from "@/components/ui/custom-button";
export type AcademicCopy = { period: string; school_year: string };
type Option = { value: string; label: string };
export function FormSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={f.label}>{label}</Text>
      <View style={f.select}>
        <Picker
          accessibilityLabel={label}
          enabled={!disabled}
          selectedValue={value}
          onValueChange={(v) => onChange(String(v))}
          style={{
            height: Platform.OS === "ios" ? 180 : 48,
            width: "100%",
            fontSize: 16,
            color: COLORS.text,
            ...(Platform.OS === "web"
              ? {
                  borderWidth: 0,
                  paddingHorizontal: 12,
                  backgroundColor: "transparent",
                }
              : {}),
          }}
        >
          <Picker.Item label="Select an option" value="" />
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}
export function FormProgress({
  labels,
  current,
  practice = false,
}: {
  labels: string[];
  current: number;
  practice?: boolean;
}) {
  return (
    <View style={f.progressCard}>
      <View style={f.between}>
        <Text style={f.eyebrow}>
          {practice ? "PRACTICE REQUEST" : "YOUR REQUEST"}
        </Text>
        <Text style={f.meta}>
          Step {current + 1} of {labels.length}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {labels.map((label, i) => (
          <View key={label} style={{ flex: 1, gap: 8 }}>
            <View
              style={[
                f.progressLine,
                {
                  backgroundColor:
                    i <= current ? COLORS.primary : COLORS.border,
                },
              ]}
            />
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={[
                  f.stepDot,
                  i <= current && { backgroundColor: COLORS.primary },
                ]}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: i <= current ? "#fff" : COLORS.gray,
                  }}
                >
                  {i < current ? "✓" : i + 1}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
      <Text accessibilityRole="header" style={f.heading}>
        {labels[current]}
      </Text>
    </View>
  );
}
export function QueueTypeCards({
  value,
  onChange,
  walkin = true,
  appointment = true,
  disabled = false,
  onNext,
}: {
  value: "walkin" | "appointment";
  onChange: (value: "walkin" | "appointment") => void;
  walkin?: boolean;
  appointment?: boolean;
  disabled?: boolean;
  onNext?: () => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={f.heading}>Select queue type</Text>
      <Text style={f.copy}>Choose how you’ll visit the office.</Text>
      {(
        [
          {
            value: "walkin",
            title: "Walk-in",
            description: "Join the queue and visit the office in person.",
            icon: "walk-outline",
            enabled: walkin,
          },
          {
            value: "appointment",
            title: "Appointment",
            description:
              "Bring your physical appointment slip on your scheduled visit.",
            icon: "calendar-outline",
            enabled: appointment,
          },
        ] as const
      )
        .filter((x) => x.enabled)
        .map((x) => (
          <TourTarget key={x.value} id={`queue-type-${x.value}`}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={x.title}
              accessibilityState={{ checked: value === x.value, disabled }}
              disabled={disabled}
              onPress={() => onChange(x.value)}
              style={({ pressed }) => [
                f.typeCard,
                value === x.value && f.selected,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={f.typeIcon}>
                <Ionicons name={x.icon} size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={f.title}>{x.title}</Text>
                <Text style={f.meta}>{x.description}</Text>
              </View>
              <Ionicons
                name={
                  value === x.value ? "radio-button-on" : "radio-button-off"
                }
                size={22}
                color={value === x.value ? COLORS.primary : COLORS.gray}
              />
            </Pressable>
          </TourTarget>
        ))}
      {!walkin && !appointment && (
        <Text accessibilityRole="alert" style={f.copy}>
          This office is not accepting queues right now.
        </Text>
      )}
      {onNext && (
        <CustomButton
          title="Continue"
          disabled={disabled || (!walkin && !appointment)}
          onPress={onNext}
        />
      )}
    </View>
  );
}
type ServiceItem = {
  id: number;
  name: string;
  category?: string;
  amount?: number | null;
  price?: number | null;
  pay_at_cashier?: boolean;
  use_academic_period?: boolean;
  choices?: { id: number; label: string }[];
};
export function ServiceRequestCard({
  item,
  selected,
  onToggle,
  quantity,
  onQuantity,
  optionId,
  onOption,
  rows,
  onAcademic,
  periods,
  years,
  sameForAll,
  onSameForAll,
  disabled = false,
}: {
  item: ServiceItem;
  selected: boolean;
  onToggle: () => void;
  quantity: number;
  onQuantity: (quantity: number) => void;
  optionId: number;
  onOption: (id: number) => void;
  rows: AcademicCopy[];
  onAcademic: (rows: AcademicCopy[]) => void;
  periods: Option[];
  years: Option[];
  sameForAll: boolean;
  onSameForAll: (same: boolean) => void;
  disabled?: boolean;
}) {
  const fee = item.amount ?? item.price;
  const copies = Array.from(
    { length: quantity },
    (_, i) => rows[i] || { period: "", school_year: "" },
  );
  const academicChange = (i: number, key: keyof AcademicCopy, value: string) =>
    onAcademic(
      copies.map((r, j) =>
        sameForAll || i === j ? { ...r, [key]: value } : r,
      ),
    );
  return (
    <View style={[f.serviceCard, selected && { borderColor: COLORS.primary }]}>
      <TourTarget id={`service-${item.id}`}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={item.name}
          accessibilityState={{ checked: selected, disabled }}
          disabled={disabled}
          onPress={onToggle}
          style={f.serviceHeader}
        >
          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={26}
            color={selected ? COLORS.primary : COLORS.gray}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={f.title}>{item.name}</Text>
            <View style={f.chips}>
              {!!item.category && <Text style={f.chip}>{item.category}</Text>}
              <Text style={f.meta}>
                {fee == null
                  ? "Fee to be confirmed"
                  : `₱${Number(fee).toFixed(2)} / copy`}
              </Text>
            </View>
            {item.pay_at_cashier && (
              <Text style={f.cashier}>Pay at cashier</Text>
            )}
          </View>
        </Pressable>
      </TourTarget>
      {selected && (
        <View style={f.serviceBody}>
          <TourTarget id={`quantity-${item.id}`}>
            <View style={f.between}>
              <View style={{ flex: 1 }}>
                <Text style={f.label}>Copies</Text>
                <Text style={f.meta}>How many do you need?</Text>
              </View>
              <View style={f.counter}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease copies · ${item.name}`}
                  accessibilityState={{ disabled: disabled || quantity <= 1 }}
                  disabled={disabled || quantity <= 1}
                  onPress={() => onQuantity(quantity - 1)}
                  style={[f.counterButton, quantity <= 1 && { opacity: 0.35 }]}
                >
                  <Ionicons name="remove" size={20} color={COLORS.primary} />
                </Pressable>
                <Text
                  accessibilityLabel={`Copies · ${item.name}: ${quantity}`}
                  style={f.count}
                >
                  {quantity}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase copies · ${item.name}`}
                  accessibilityState={{ disabled: disabled || quantity >= 99 }}
                  disabled={disabled || quantity >= 99}
                  onPress={() => onQuantity(quantity + 1)}
                  style={[f.counterButton, quantity >= 99 && { opacity: 0.35 }]}
                >
                  <Ionicons name="add" size={20} color={COLORS.primary} />
                </Pressable>
              </View>
            </View>
          </TourTarget>
          {!!item.choices?.length && (
            <TourTarget id={`option-${item.id}`}>
              <View style={{ gap: 8 }}>
                <Text style={f.label}>Choose an option</Text>
                <View style={f.chips}>
                  {item.choices.map((choice) => (
                    <Pressable
                      key={choice.id}
                      accessibilityRole="radio"
                      accessibilityLabel={`Option · ${item.name} · ${choice.label}`}
                      accessibilityState={{
                        checked: optionId === choice.id,
                        disabled,
                      }}
                      disabled={disabled}
                      onPress={() => onOption(choice.id)}
                      style={[
                        f.option,
                        optionId === choice.id && f.optionSelected,
                      ]}
                    >
                      <Ionicons
                        name={
                          optionId === choice.id
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={18}
                        color={optionId === choice.id ? "#fff" : COLORS.gray}
                      />
                      <Text
                        style={[
                          f.optionText,
                          optionId === choice.id && { color: "#fff" },
                        ]}
                      >
                        {choice.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </TourTarget>
          )}
          {!!item.use_academic_period && (
            <View style={f.academicPanel}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Ionicons
                  name="school-outline"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={f.label}>Academic details</Text>
              </View>
              <Text style={f.meta}>
                Choose the period and school year for each copy.
              </Text>
              {quantity > 1 && (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Use the same academic details for all copies · ${item.name}`}
                  accessibilityState={{ checked: sameForAll, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    const next = !sameForAll;
                    onSameForAll(next);
                    if (next) onAcademic(copies.map(() => ({ ...copies[0] })));
                  }}
                  style={f.same}
                >
                  <Ionicons
                    name={sameForAll ? "checkbox" : "square-outline"}
                    size={24}
                    color={COLORS.primary}
                  />
                  <Text style={[f.meta, { flex: 1, color: COLORS.text }]}>
                    Use the same details for all copies
                  </Text>
                </Pressable>
              )}
              {copies.map((copy, i) =>
                sameForAll && i > 0 ? null : (
                  <View key={i} style={f.copyPanel}>
                    <Text style={f.copyLabel}>
                      {sameForAll && quantity > 1
                        ? `Applies to all ${quantity} copies`
                        : `Copy ${i + 1}`}
                    </Text>
                    <TourTarget
                      id={
                        i === 0 ? `period-${item.id}` : `period-${item.id}-${i}`
                      }
                    >
                      <FormSelect
                        label="Academic period"
                        value={copy.period}
                        options={periods}
                        onChange={(v) => academicChange(i, "period", v)}
                        disabled={disabled}
                      />
                    </TourTarget>
                    <TourTarget
                      id={
                        i === 0
                          ? `school-year-${item.id}`
                          : `school-year-${item.id}-${i}`
                      }
                    >
                      <FormSelect
                        label="School year"
                        value={copy.school_year}
                        options={years}
                        onChange={(v) => academicChange(i, "school_year", v)}
                        disabled={disabled}
                      />
                    </TourTarget>
                  </View>
                ),
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
export const f = StyleSheet.create({
  progressCard: {
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    gap: 16,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: COLORS.gray,
  },
  progressLine: { height: 3, borderRadius: 2 },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.lightGray,
  },
  heading: {
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: COLORS.text,
  },
  title: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    color: COLORS.text,
  },
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    color: COLORS.text,
  },
  copy: { fontSize: 16, lineHeight: 24, color: COLORS.gray },
  meta: { fontSize: 14, lineHeight: 21, color: COLORS.gray },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    minHeight: 100,
  },
  typeIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
  },
  selected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  serviceCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  serviceHeader: {
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 90,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cashier: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.info,
    fontWeight: "600",
  },
  serviceBody: { padding: 20, paddingTop: 0, gap: 24 },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#fff",
  },
  counterButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  count: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: COLORS.primary,
    minWidth: 32,
    textAlign: "center",
  },
  option: {
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
  },
  optionSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: COLORS.text,
    flexShrink: 1,
  },
  academicPanel: {
    padding: 12,
    gap: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  same: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  copyPanel: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  copyLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  select: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#858D9A",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
});
