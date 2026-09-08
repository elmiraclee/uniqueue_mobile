import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { COLORS } from '../../constants/theme';

interface ServiceItem {
  id: number;
  name: string;
  requirements: string[];
}

interface Props {
  service_items: ServiceItem[];
  selectedServiceItems: number[];
  quantities: Record<number, number>;
  setQuantities: React.Dispatch<
    React.SetStateAction<Record<number, number>>
  >;
  onNext: () => void;
  onBack: () => void;
}

export default function QuantityStep({
  service_items,
  selectedServiceItems,
  quantities,
  setQuantities,
  onNext,
  onBack,
}: Props) {
  const updateQuantity = (
    id: number,
    action: 'add' | 'minus'
  ) => {
    const current = quantities[id] || 1;
    let newQty = current;

    if (action === 'add') newQty++;
    if (action === 'minus' && current > 1) newQty--;

    setQuantities({ ...quantities, [id]: newQty });
  };

  return (
    <View>
      <Text style={styles.title}>
        Service item quantity
      </Text>

      <Text style={styles.subtitle}>
        Set how many copies you need for each service item.
      </Text>

      {service_items
        .filter((item) =>
          selectedServiceItems.includes(item.id)
        )
        .map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.docName}>
              {item.name}
            </Text>

            <View style={styles.qtyContainer}>
              <TouchableOpacity
                style={[
                  styles.qtyButton,
                  (quantities[item.id] || 1) <= 1 &&
                    styles.qtyButtonDisabled,
                ]}
                onPress={() =>
                  updateQuantity(item.id, 'minus')
                }
              >
                <Text style={styles.qtyText}>−</Text>
              </TouchableOpacity>

              <Text style={styles.quantity}>
                {quantities[item.id] || 1}
              </Text>

              <TouchableOpacity
                style={styles.qtyButton}
                onPress={() =>
                  updateQuantity(item.id, 'add')
                }
              >
                <Text style={styles.qtyText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

      <TouchableOpacity
        style={styles.button}
        onPress={onNext}
      >
        <Text style={styles.buttonText}>
          Continue
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={onBack}
      >
        <Text style={styles.backButtonText}>
          Back
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: COLORS.primary,
  },

  subtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 16,
  },

  card: {
    backgroundColor: COLORS.white,
    padding: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
  },

  docName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 14,
  },

  qtyContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },

  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyButtonDisabled: {
    backgroundColor: '#ddd',
  },

  qtyText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },

  quantity: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.secondary,
    minWidth: 32,
    textAlign: 'center',
  },

  button: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    marginTop: 8,
  },

  buttonText: {
    color: COLORS.white,
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