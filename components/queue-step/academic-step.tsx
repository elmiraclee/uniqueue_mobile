import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/** per service item id → array of { period, school_year } length = quantity */
export type AcademicMap = Record<number, { period: string; school_year: string }[]>;

interface Props {
  items: { id: number; name: string; use_academic_period?: boolean }[];
  selectedIds: number[];
  quantities: Record<number, number>;
  academic: AcademicMap;
  setAcademic: (a: AcademicMap) => void;
  periods: { id: number; label: string }[];
  schoolYears: { id: number; school_year: string }[];
  onNext: () => void;
  onBack: () => void;
}

export default function AcademicStep({
  items,
  selectedIds,
  quantities,
  academic,
  setAcademic,
  periods,
  schoolYears,
  onNext,
  onBack,
}: Props) {
  const needing = items.filter(
    (i) => selectedIds.includes(i.id) && i.use_academic_period
  );

  const setCopy = (itemId: number, copyIdx: number, field: 'period' | 'school_year', value: string) => {
    const qty = quantities[itemId] || 1;
    const arr = [...(academic[itemId] || Array.from({ length: qty }, () => ({ period: '', school_year: '' })))];
    while (arr.length < qty) arr.push({ period: '', school_year: '' });
    arr[copyIdx] = { ...arr[copyIdx], [field]: value };
    setAcademic({ ...academic, [itemId]: arr });
  };

  const allFilled = needing.every((i) => {
    const qty = quantities[i.id] || 1;
    const arr = academic[i.id] || [];
    if (arr.length < qty) return false;
    return arr.slice(0, qty).every((a) => a.period && a.school_year);
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Academic period</Text>
      <Text style={styles.sub}>Select period and school year for each copy.</Text>
      <ScrollView style={{ flex: 1 }}>
        {needing.map((item) => {
          const qty = quantities[item.id] || 1;
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              {Array.from({ length: qty }).map((_, idx) => (
                <View key={idx} style={styles.copyBlock}>
                  <Text style={styles.copyLabel}>Copy {idx + 1}</Text>
                  <Text style={styles.fieldLabel}>Period</Text>
                  <View style={styles.pills}>
                    {periods.map((p) => {
                      const active = academic[item.id]?.[idx]?.period === p.label;
                      return (
                        <TouchableOpacity
                          key={p.id || p.label}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() => setCopy(item.id, idx, 'period', p.label)}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.fieldLabel}>School year</Text>
                  <View style={styles.pills}>
                    {schoolYears.map((y) => {
                      const active = academic[item.id]?.[idx]?.school_year === y.school_year;
                      return (
                        <TouchableOpacity
                          key={y.id || y.school_year}
                          style={[styles.pill, active && styles.pillActive]}
                          onPress={() => setCopy(item.id, idx, 'school_year', y.school_year)}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>
                            {y.school_year}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
        {needing.length === 0 && (
          <Text style={styles.sub}>No academic details required.</Text>
        )}
      </ScrollView>
      <View style={styles.row}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.next, !allFilled && needing.length > 0 && { opacity: 0.5 }]}
          disabled={!allFilled && needing.length > 0}
          onPress={onNext}
        >
          <Text style={styles.nextText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: SPACING.lg },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  sub: { color: COLORS.gray, marginBottom: 12, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 14, marginBottom: 10 },
  name: { fontWeight: '700', marginBottom: 8 },
  copyBlock: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  copyLabel: { fontWeight: '600', marginBottom: 6 },
  fieldLabel: { fontSize: 12, color: COLORS.gray, marginTop: 6, marginBottom: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  pillText: { fontWeight: '600', color: COLORS.gray, fontSize: 13 },
  pillTextActive: { color: COLORS.primary },
  row: { flexDirection: 'row', gap: 10, marginTop: 12 },
  back: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backText: { fontWeight: '700', color: COLORS.gray },
  next: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextText: { color: '#fff', fontWeight: '700' },
});
