import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../constants/theme';

interface DocumentItem {
  id: number;
  name: string;
  requirements: string[];
}

interface Props {
  queueType: 'walkin' | 'appointment';
  // Appointment holders are verified via their physical Appointment Slip
  // rather than a date picked here — this wizard doesn't collect an
  // appointment date at all.
  appointmentSlipConfirmed: boolean;
  documents: DocumentItem[];
  selectedDocuments: number[];
  // Copies requested per document, keyed by document id. Set in
  // DocumentStep alongside the selection itself.
  quantities: Record<number, number>;
  // Priority lane, chosen inline in DocumentStep. priorityReason is
  // only meaningful when priority is true.
  priority: boolean;
  priorityReason: string;
  onSubmit: () => void;
  onBack: () => void;
  submitting?: boolean;
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export default function ReviewStep({
  queueType,
  appointmentSlipConfirmed,
  documents,
  selectedDocuments,
  quantities,
  priority,
  priorityReason,
  onSubmit,
  onBack,
  submitting,
}: Props) {
  const disabled =
    submitting ||
    (queueType === 'appointment' && !appointmentSlipConfirmed);

  return (
    <View>
      <Text style={styles.title}>
        Review your request
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>
          Queue details
        </Text>

        <InfoRow
          label="Type"
          value={
            queueType === 'walkin'
              ? 'Walk-in'
              : 'Appointment'
          }
        />

        <InfoRow
          label="Priority lane"
          value={priority ? 'Yes' : 'No'}
        />

        {priority && !!priorityReason.trim() && (
          <InfoRow
            label="Reason"
            value={priorityReason.trim()}
          />
        )}
      </View>

      {queueType === 'appointment' && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            Appointment slip
          </Text>

          <InfoRow
            label="Confirmed"
            value={appointmentSlipConfirmed ? 'Yes' : 'No'}
          />

          {!appointmentSlipConfirmed && (
            <Text style={styles.helperText}>
              Go back to Requirements and confirm you have your
              Appointment Slip before joining the queue.
            </Text>
          )}
        </View>
      )}

      {selectedDocuments.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            Documents / services requested
          </Text>

          {documents
            .filter((doc) =>
              selectedDocuments.includes(doc.id)
            )
            .map((doc) => (
              <View
                key={doc.id}
                style={styles.docRow}
              >
                <Text style={styles.docName}>
                  {doc.name}
                </Text>
                <Text style={styles.docQty}>
                  x{quantities[doc.id] || 1}
                </Text>
              </View>
            ))}
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          disabled && styles.disabledButton,
        ]}
        disabled={disabled}
        onPress={onSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.buttonText}>
            Join queue
          </Text>
        )}
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
    marginBottom: 16,
    color: COLORS.primary,
  },

  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#eee',
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0e8e8',
  },

  label: {
    fontSize: 13,
    color: COLORS.gray,
  },

  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    maxWidth: '60%',
    textAlign: 'right',
  },

  helperText: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
  },

  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0e8e8',
  },

  docName: {
    fontSize: 14,
    color: COLORS.secondary,
    flex: 1,
  },

  docQty: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 12,
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

  disabledButton: {
    opacity: 0.5,
  },
});