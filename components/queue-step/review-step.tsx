import React from 'react';
import { feeSummary } from '@/utils/queue-domain';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { AcademicMap } from './academic-step';
import { ChoiceMap } from './choice-step';
import { COLORS } from '../../constants/theme';

interface ServiceItem {
  id: number;
  name: string;
  requirements: string[];
  amount?: number | null;
  price?: number | null;
  pay_at_cashier?: boolean;
}

interface Props {
  queueType: 'walkin' | 'appointment';
  // Appointment holders are verified via their physical Appointment Slip
  // rather than a date picked here — this wizard doesn't collect an
  // appointment date at all.
  appointmentSlipConfirmed: boolean;
  service_items: ServiceItem[];
  selectedServiceItems: number[];
  // Copies requested per service item, keyed by service item id. Set in
  // ServiceItemStep alongside the selection itself.
  quantities: Record<number, number>;
  // Priority lane, chosen inline in ServiceItemStep. priorityReason is
  // only meaningful when priority is true.
  priority: boolean;
  priorityReason: string;
  onSubmit: () => void;
  onBack: () => void;
  submitting?: boolean;
  academic?: AcademicMap;
  itemChoices?: ChoiceMap;
  practice?: boolean;
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
  service_items,
  selectedServiceItems,
  quantities,
  priority,
  priorityReason,
  onSubmit,
  onBack,
  submitting,
  academic = {}, itemChoices = {}, practice = false,
}: Props) {
  const fees = feeSummary(service_items, selectedServiceItems, quantities);
  const money = (amount: number) => `₱${amount.toFixed(2)}`;
  const disabled =
    practice || submitting ||
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

      {selectedServiceItems.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            Service items / services requested
          </Text>

          {service_items
            .filter((item) =>
              selectedServiceItems.includes(item.id)
            )
            .map((item) => (
              <View
                key={item.id}
                style={[styles.docRow,{flexWrap:"wrap",gap:8}]}
              >
                <Text style={[styles.docName,{width:"100%",flex:undefined,fontSize:16}]}>
                  {item.name}
                </Text>
                <View style={{flex:1,gap:4}}>{!!itemChoices[item.id]?.choice_label&&<Text>{itemChoices[item.id].choice_label}</Text>}{(academic[item.id]||[]).slice(0,quantities[item.id]||1).map((a,i)=><Text key={i} style={{fontSize:14,lineHeight:20,color:COLORS.gray}}>Copy {i+1}: {a.period||"Not selected"} / {a.school_year||"Not selected"}</Text>)}</View>
                <Text style={styles.docQty}>
                  x{quantities[item.id] || 1}
                </Text>
                <Text style={{ width: '100%', color: COLORS.gray, marginTop: 6 }}>
                  {(item.amount ?? item.price) == null ? 'Amount: to be confirmed by the office' : `Unit amount: ${money(Number(item.amount ?? item.price))} · Subtotal: ${money(Number(item.amount ?? item.price) * (quantities[item.id] || 1))}`}
                  {item.pay_at_cashier ? ' · Pay at cashier' : ''}
                </Text>
              </View>
            ))}
          <InfoRow label={fees.complete ? 'Total amount' : 'Known amounts only'} value={money(fees.total)} />
          {!fees.complete && <Text style={styles.helperText}>Some amounts must be confirmed by the office. This is not the final total.</Text>}
        </View>
      )}

      {practice&&<Text style={{fontSize:14,lineHeight:20,color:COLORS.primary,marginBottom:12}}>Practice only. This request cannot create a ticket or payment.</Text>}
      <TouchableOpacity
        style={[
          styles.button,
          disabled && styles.disabledButton,
        ]}
        disabled={disabled || practice}
        accessibilityRole="button" accessibilityState={{disabled}} onPress={practice ? undefined : onSubmit}
      >
        {submitting ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.buttonText}>
            {practice ? 'Practice — join disabled' : 'Join queue'}
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