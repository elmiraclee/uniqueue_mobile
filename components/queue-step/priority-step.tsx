import React from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { COLORS } from '../../constants/theme';

interface Props {
  priority: boolean;
  setPriority: (value: boolean) => void;
  priorityReason: string;
  setPriorityReason: (text: string) => void;
  // Whether this office offers a priority lane at all. When it's off,
  // this renders nothing — mirrors office_configs.priority_enabled
  // gating the option out entirely rather than showing a disabled card.
  priorityEnabled: boolean;
}

// No longer its own step (no onNext/onBack, no Continue/Back buttons).
// This now renders inline inside DocumentStep, right where documents
// are being picked, since priority lane is just another attribute of
// that same selection instead of a separate screen.
export default function PriorityStep({
  priority,
  setPriority,
  priorityReason,
  setPriorityReason,
  priorityEnabled,
}: Props) {
  if (!priorityEnabled) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Priority lane</Text>

      <TouchableOpacity
        style={[styles.card, priority && styles.selected]}
        onPress={() => setPriority(!priority)}
      >
        <View style={styles.radioRow}>
          <View style={[styles.radio, priority && styles.radioActive]}>
            {priority && <View style={styles.radioDot} />}
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardText}>Apply for priority lane</Text>
            <Text style={styles.cardSub}>
              For PWD, senior citizens, and pregnant
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, !priority && styles.selected]}
        onPress={() => setPriority(false)}
      >
        <View style={styles.radioRow}>
          <View style={[styles.radio, !priority && styles.radioActive]}>
            {!priority && <View style={styles.radioDot} />}
          </View>

          <View style={styles.cardContent}>
            <Text style={styles.cardText}>Regular lane</Text>
            <Text style={styles.cardSub}>Standard queue placement</Text>
          </View>
        </View>
      </TouchableOpacity>

      {priority && (
        <TextInput
          style={styles.input}
          placeholder="Enter reason for priority"
          placeholderTextColor={COLORS.gray}
          value={priorityReason}
          onChangeText={setPriorityReason}
          multiline
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 8,
    marginBottom: 8,
  },

  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    color: COLORS.secondary,
  },

  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
  },

  selected: {
    borderColor: COLORS.primary,
    backgroundColor: '#fdf5f5',
  },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },

  radioActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },

  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  cardContent: {
    flex: 1,
  },

  cardText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.secondary,
  },

  cardSub: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },

  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.white,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});