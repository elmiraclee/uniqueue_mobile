import { clientAlert } from '@/components/client/client-ui';
import React from 'react';
import {
    Alert,
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
  choices?: { id: number; label: string; requirements?: string[] }[];
}

interface Props {
  service_items: ServiceItem[];
  selectedServiceItems: number[];
  checkedRequirements: string[];
  setCheckedRequirements: React.Dispatch<
    React.SetStateAction<string[]>
  >;
  // Appointment holders are verified via their physical Appointment Slip
  // rather than the per-service-item requirements checklist, so this step
  // shows a single mandatory checkbox for them instead — mirrors the
  // #apptRequirementBox vs #requirementsBox split in queue.php.
  queueType: 'walkin' | 'appointment';
  appointmentSlipConfirmed: boolean;
  setAppointmentSlipConfirmed: (value: boolean) => void;
  // Selected choice per service item — its own extra requirements are
  // added to the checklist (web: service_item_choice_requirements).
  itemChoices?: Record<number, { choice_id: number; choice_label: string }>;
  onNext: () => void;
  onBack: () => void;
}

export default function RequirementStep({
  service_items,
  selectedServiceItems,
  checkedRequirements,
  setCheckedRequirements,
  queueType,
  appointmentSlipConfirmed,
  setAppointmentSlipConfirmed,
  itemChoices = {},
  onNext,
  onBack,
}: Props) {
  if (queueType === 'appointment') {
    return (
      <View>
        <Text style={styles.title}>
          Requirements checklist
        </Text>

        <Text style={styles.subtitle}>
          Make sure you have this ready before proceeding.
        </Text>

        <TouchableOpacity
          style={[
            styles.card,
            appointmentSlipConfirmed && styles.checkedCard,
          ]}
          onPress={() =>
            setAppointmentSlipConfirmed(!appointmentSlipConfirmed)
          }
        >
          <View
            style={[
              styles.checkbox,
              appointmentSlipConfirmed && styles.checkboxActive,
            ]}
          >
            {appointmentSlipConfirmed && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </View>

          <Text style={styles.requirementText}>
            Bring your Appointment Slip / confirmation to present at the
            window.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            if (!appointmentSlipConfirmed) {
              clientAlert(
                'Required',
                'Please confirm you have your Appointment Slip.'
              );
              return;
            }
            onNext();
          }}
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

  const requirements = [
    ...new Set(
      service_items
        .filter((item) => selectedServiceItems.includes(item.id))
        .flatMap((item) => {
          const base = item.requirements ?? [];
          const sel = itemChoices[item.id];
          const choice = sel
            ? (item.choices ?? []).find((c) => Number(c.id) === Number(sel.choice_id))
            : undefined;
          return [...base, ...(choice?.requirements ?? [])];
        })
    ),
  ];

  const toggle = (req: string) => {
    if (checkedRequirements.includes(req)) {
      setCheckedRequirements(
        checkedRequirements.filter((item) => item !== req)
      );
    } else {
      setCheckedRequirements([
        ...checkedRequirements,
        req,
      ]);
    }
  };

  const next = () => {
    const checkedCurrentRequirements =
      requirements.filter((req) =>
        checkedRequirements.includes(req)
      );

    if (
      checkedCurrentRequirements.length <
      requirements.length
    ) {
      clientAlert(
        'Incomplete',
        'Please check all requirements before proceeding.'
      );
      return;
    }

    onNext();
  };

  const checkedCount = requirements.filter((req) =>
    checkedRequirements.includes(req)
  ).length;
  
  return (
    <View>
      <Text style={styles.title}>
        Requirements checklist
      </Text>

      <Text style={styles.subtitle}>
        Make sure you have all these ready before proceeding.
      </Text>

      {requirements.length > 0 && (
        <View style={styles.progress}>
          <Text style={styles.progressText}>
            {checkedCount} of {requirements.length} checked
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    (checkedCount / requirements.length) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {requirements.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No requirements found.
          </Text>
        </View>
      ) : (
        requirements.map((req, index) => (
          <TouchableOpacity
            key={`${req}-${index}`}
            style={[
              styles.card,
              checkedRequirements.includes(req) &&
                styles.checkedCard,
            ]}
            onPress={() => toggle(req)}
          >
            <View
              style={[
                styles.checkbox,
                checkedRequirements.includes(req) &&
                  styles.checkboxActive,
              ]}
            >
              {checkedRequirements.includes(req) && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>

            <Text style={styles.requirementText}>
              {req}
            </Text>
          </TouchableOpacity>
        ))
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={next}
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
    color: COLORS.primary,
    marginBottom: 6,
  },

  subtitle: {
    color: COLORS.gray,
    marginBottom: 14,
    fontSize: 13,
  },

  progress: {
    marginBottom: 16,
  },

  progressText: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 6,
  },

  progressBar: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },

  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },

  checkedCard: {
    borderColor: COLORS.primary,
    backgroundColor: '#fdf5f5',
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

  requirementText: {
    fontSize: 14,
    flex: 1,
    color: COLORS.secondary,
  },

  emptyCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },

  emptyText: {
    color: COLORS.gray,
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