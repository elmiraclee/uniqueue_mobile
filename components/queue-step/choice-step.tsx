import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export type ChoiceMap = Record<number, { choice_id: number; choice_label: string }>;

interface Choice {
  id: number;
  label: string;
  requirements?: string[];
}

interface ItemWithChoices {
  id: number;
  name: string;
  choices?: Choice[];
  has_choices?: boolean;
}

interface Props {
  items: ItemWithChoices[];
  selectedIds: number[];
  choices: ChoiceMap;
  setChoices: (c: ChoiceMap) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function ChoiceStep({
  items,
  selectedIds,
  choices,
  setChoices,
  onNext,
  onBack,
}: Props) {
  const needing = items.filter(
    (i) => selectedIds.includes(i.id) && (i.has_choices || (i.choices && i.choices.length > 0))
  );

  const allPicked = needing.every((i) => choices[i.id]?.choice_id);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Select options</Text>
      <Text style={styles.sub}>Some services need a specific choice (e.g. size).</Text>
      <ScrollView style={{ flex: 1 }}>
        {needing.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.pills}>
              {(item.choices || []).map((ch) => {
                const active = choices[item.id]?.choice_id === ch.id;
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() =>
                      setChoices({
                        ...choices,
                        [item.id]: { choice_id: ch.id, choice_label: ch.label },
                      })
                    }
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{ch.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
        {needing.length === 0 && (
          <Text style={styles.sub}>No choices required for selected services.</Text>
        )}
      </ScrollView>
      <View style={styles.row}>
        <TouchableOpacity style={styles.back} onPress={onBack}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.next, !allPicked && needing.length > 0 && { opacity: 0.5 }]}
          disabled={!allPicked && needing.length > 0}
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
  name: { fontWeight: '700', marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '15' },
  pillText: { fontWeight: '600', color: COLORS.gray },
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
