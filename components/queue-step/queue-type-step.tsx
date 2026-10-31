import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { COLORS } from '../../constants/theme';

interface Props {
  queueType: 'walkin' | 'appointment';
  setQueueType: (type: 'walkin' | 'appointment') => void;
  // Whether this office currently accepts each queue type. Options the
  // office has turned off are hidden entirely rather than shown disabled,
  // matching queue.php only rendering the type-card markup for enabled
  // types.
  walkinEnabled: boolean;
  appointmentEnabled: boolean;
  onNext: () => void;
}

export default function QueueTypeStep({
  queueType,
  setQueueType,
  walkinEnabled,
  appointmentEnabled,
  onNext,
}: Props) {
  const noTypesAvailable = !walkinEnabled && !appointmentEnabled;

  return (
    <View>
      <Text style={styles.title}>
        Select queue type
      </Text>

      {walkinEnabled && (
        <TouchableOpacity
          style={[
            styles.card,
            queueType === 'walkin' && styles.selected,
          ]}
          onPress={() => setQueueType('walkin')}
        >
          <View style={styles.radioRow}>
            <View
              style={[
                styles.radio,
                queueType === 'walkin' && styles.radioActive,
              ]}
            >
              {queueType === 'walkin' && (
                <View style={styles.radioDot} />
              )}
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardText}>
                Walk-in
              </Text>
              <Text style={styles.cardSub}>
                Queue in person at the office
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {appointmentEnabled && (
        <TouchableOpacity
          style={[
            styles.card,
            queueType === 'appointment' && styles.selected,
          ]}
          onPress={() => setQueueType('appointment')}
        >
          <View style={styles.radioRow}>
            <View
              style={[
                styles.radio,
                queueType === 'appointment' &&
                  styles.radioActive,
              ]}
            >
              {queueType === 'appointment' && (
                <View style={styles.radioDot} />
              )}
            </View>

            <View style={styles.cardContent}>
              <Text style={styles.cardText}>
                Appointment
              </Text>
              <Text style={styles.cardSub}>
                Bring your appointment slip on your scheduled date
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {noTypesAvailable && (
        <View style={styles.card}>
          <Text style={styles.cardSub}>
            This office isn’t accepting queues right now.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, noTypesAvailable && styles.buttonDisabled]}
        disabled={noTypesAvailable}
        onPress={onNext}
      >
        <Text style={styles.buttonText}>
          Continue
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 16,
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

  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
});