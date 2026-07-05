import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../constants/theme';
import PriorityStep from './priority-step';

interface DocumentItem {
  id: number;
  name: string;
  requirements: string[];
}

interface Props {
  documents: DocumentItem[];
  selectedDocuments: number[];
  setSelectedDocuments: React.Dispatch<React.SetStateAction<number[]>>;

  // Quantity per selected document, keyed by document id. Folded in
  // here instead of a separate QuantityStep so quantity is set right
  // where the document is picked.
  quantities: Record<number, number>;
  setQuantities: React.Dispatch<React.SetStateAction<Record<number, number>>>;

  // Priority lane, folded in here instead of its own step. Rendered
  // via PriorityLane, which no-ops when the office doesn't offer it.
  priority: boolean;
  setPriority: (value: boolean) => void;
  priorityReason: string;
  setPriorityReason: (text: string) => void;
  priorityEnabled: boolean;

  onNext: () => void;
  onBack: () => void;
}

export default function DocumentStep({
  documents,
  selectedDocuments,
  setSelectedDocuments,
  quantities,
  setQuantities,
  priority,
  setPriority,
  priorityReason,
  setPriorityReason,
  priorityEnabled,
  onNext,
  onBack,
}: Props) {
  const toggle = (id: number) => {
    if (selectedDocuments.includes(id)) {
      setSelectedDocuments(selectedDocuments.filter((item) => item !== id));

      // Drop its quantity so a re-selected document starts fresh at 1
      // instead of remembering a stale count.
      setQuantities((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setSelectedDocuments([...selectedDocuments, id]);
      setQuantities((prev) => ({ ...prev, [id]: prev[id] || 1 }));
    }
  };

  const updateQuantity = (id: number, action: 'add' | 'minus') => {
    const current = quantities[id] || 1;
    let newQty = current;

    if (action === 'add') newQty++;
    if (action === 'minus' && current > 1) newQty--;

    setQuantities({ ...quantities, [id]: newQty });
  };

  const next = () => {
    if (selectedDocuments.length === 0) {
      Alert.alert('Required', 'Select at least one document.');
      return;
    }

    if (priorityEnabled && priority && !priorityReason.trim()) {
      Alert.alert('Required', 'Please enter a reason for priority lane.');
      return;
    }

    onNext();
  };

  return (
    <View>
      <Text style={styles.title}>Select documents</Text>

      <Text style={styles.subtitle}>
        Choose the document or service you need from this office.
      </Text>

      {documents.map((doc) => {
        const isSelected = selectedDocuments.includes(doc.id);

        return (
          <View
            key={doc.id}
            style={[styles.card, isSelected && styles.selected]}
          >
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => toggle(doc.id)}
            >
              <View
                style={[styles.checkbox, isSelected && styles.checkboxActive]}
              >
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>

              <Text style={styles.cardText}>{doc.name}</Text>
            </TouchableOpacity>

            {isSelected && (
              <View style={styles.qtyContainer}>
                <Text style={styles.qtyLabel}>Copies</Text>

                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={[
                      styles.qtyButton,
                      (quantities[doc.id] || 1) <= 1 &&
                        styles.qtyButtonDisabled,
                    ]}
                    onPress={() => updateQuantity(doc.id, 'minus')}
                  >
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>

                  <Text style={styles.qtyValue}>
                    {quantities[doc.id] || 1}
                  </Text>

                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateQuantity(doc.id, 'add')}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}

      <PriorityStep
        priority={priority}
        setPriority={setPriority}
        priorityReason={priorityReason}
        setPriorityReason={setPriorityReason}
        priorityEnabled={priorityEnabled}
      />

      <TouchableOpacity style={styles.button} onPress={next}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 16,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#eee',
    overflow: 'hidden',
  },

  selected: {
    borderColor: COLORS.primary,
    backgroundColor: '#fdf5f5',
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },

  checkboxActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },

  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  cardText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    flex: 1,
  },

  qtyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },

  qtyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },

  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyButtonDisabled: {
    backgroundColor: '#ddd',
  },

  qtyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 19,
  },

  qtyValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.secondary,
    minWidth: 20,
    textAlign: 'center',
  },

  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
  },

  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },

  backButton: {
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ddd',
  },

  backButtonText: {
    color: COLORS.gray,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
});