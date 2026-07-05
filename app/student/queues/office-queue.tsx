import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import AppHeader from '../../../components/layout/app-header';
import DocumentStep from '../../../components/queue/document-step';
import QueueTypeStep from '../../../components/queue/queue-type-step';
import RequirementStep from '../../../components/queue/requirement-step';
import ReviewStep from '../../../components/queue/review-step';
import { COLORS } from '../../../constants/theme';

export interface Document {
  id: number;
  name: string;
  requirements: string[];
}

// A single office record, resolved dynamically by slug. One screen now
// serves every office; behavior adapts via these flags instead of the
// screen being duplicated per office.
export interface Office {
  id: number;
  name: string;
  slug: string;
  description?: string;
  walkinEnabled: boolean;
  appointmentEnabled: boolean;
  priorityEnabled: boolean;
}

const API_BASE = 'http://192.168.1.26/uniqueue_api';

// Four steps for every office: Type -> Details (documents + quantity +
// priority lane, all scoped to this office) -> Requirements -> Confirm.
// Priority used to be its own step and quantity didn't exist yet; both
// now live inside Details since they're just more attributes of the
// same document selection.
const STEPS = [
  { label: 'Type' },
  { label: 'Details' },
  { label: 'Requirements' },
  { label: 'Confirm' },
];

function StepIndicator({ current }: { current: number }) {
  const visualIndex = current - 1;

  return (
    <View style={indicator.wrapper}>
      <View style={indicator.row}>
        {STEPS.map((step, i) => {
          const isDone = i < visualIndex;
          const isActive = i === visualIndex;

          return (
            <View key={i} style={indicator.stepGroup}>
              <View
                style={[
                  indicator.dot,
                  isDone && indicator.dotDone,
                  isActive && indicator.dotActive,
                  !isDone && !isActive && indicator.dotTodo,
                ]}
              >
                {isDone ? (
                  <Text style={indicator.dotTextDone}>✓</Text>
                ) : (
                  <Text
                    style={[
                      indicator.dotText,
                      isActive && indicator.dotTextActive,
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>

              {i < STEPS.length - 1 && (
                <View
                  style={[indicator.line, isDone && indicator.lineDone]}
                />
              )}
            </View>
          );
        })}
      </View>

      <Text style={indicator.label}>{STEPS[visualIndex]?.label ?? ''}</Text>
    </View>
  );
}

const indicator = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  stepGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dotDone: {
    backgroundColor: COLORS.primary,
  },

  dotActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: '#f5c5c8',
  },

  dotTodo: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#ddd',
  },

  dotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#bbb',
  },

  dotTextActive: {
    color: '#fff',
  },

  dotTextDone: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 3,
  },

  lineDone: {
    backgroundColor: COLORS.primary,
  },

  label: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default function OfficeQueue() {
  const router = useRouter();

  // OFFICE — resolved dynamically from the `office` route param instead of
  // a hardcoded office_id: one screen, many offices, behavior driven by
  // that office's own config.
  const { office: officeSlug } = useLocalSearchParams<{ office?: string }>();

  const [office, setOffice] = useState<Office | null>(null);
  const [loadingOffice, setLoadingOffice] = useState(true);

  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState(0);

  const [queueType, setQueueType] =
    useState<'walkin' | 'appointment'>('walkin');

  // Appointment holders confirm they have their physical Appointment Slip
  // instead of picking a date here.
  const [appointmentSlipConfirmed, setAppointmentSlipConfirmed] =
    useState(false);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [checkedRequirements, setCheckedRequirements] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const [priority, setPriority] = useState(false);
  const [priorityReason, setPriorityReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Reused from registrar-queue.tsx: the server assigns a window and a
  // human-facing queue number when the ticket is created, and the
  // client just displays whatever it's given.
  const [queueNumber, setQueueNumber] = useState('');
  const [assignedWindow, setAssignedWindow] = useState('');

  useEffect(() => {
    if (!officeSlug) {
      // No office selected — bounce back to the dashboard.
      Alert.alert('Error', 'No office selected.');
      router.replace('/student/home');
      return;
    }

    loadUser();
    fetchOffice(officeSlug);
  }, [officeSlug]);

  useEffect(() => {
    if (!office) return;
    fetchDocuments(office.id);
  }, [office]);

  const loadUser = async () => {
    const user = await AsyncStorage.getItem('user');
    if (user) {
      const parsed = JSON.parse(user);
      setStudentId(parsed.id);
    }
  };

  const fetchOffice = async (slug: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/queue_process.php?slug=${encodeURIComponent(slug)}`
      );
      const data = await response.json();

      if (!data.success || !data.office) {
        Alert.alert('Error', 'That office is not available.');
        router.replace('/student/home');
        return;
      }

      // Fall back to enabled if the office has no config row yet.
      const o = data.office;
      setOffice({
        id: o.id,
        name: o.name,
        slug: o.slug,
        description: o.description,
        walkinEnabled: o.walkin_enabled === null ? true : !!o.walkin_enabled,
        appointmentEnabled:
          o.appointment_enabled === null ? true : !!o.appointment_enabled,
        priorityEnabled:
          o.priority_enabled === null ? true : !!o.priority_enabled,
      });

      // Default queue type to whichever option this office actually
      // supports.
      if (o.walkin_enabled === false && o.appointment_enabled !== false) {
        setQueueType('appointment');
      } else {
        setQueueType('walkin');
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Unable to load this office right now.');
      router.replace('/student/home');
    } finally {
      setLoadingOffice(false);
    }
  };

  // DOCUMENTS — scoped to this office only, and used by both queue types.
  const fetchDocuments = async (officeId: number) => {
    try {
      const response = await fetch(
        `${API_BASE}/get_documents.php?office_id=${officeId}`
      );
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const resetForm = () => {
    setStep(1);
    setQueueType('walkin');
    setAppointmentSlipConfirmed(false);
    setSelectedDocuments([]);
    setCheckedRequirements([]);
    setQuantities({});
    setPriority(false);
    setPriorityReason('');
    setQueueNumber('');
    setAssignedWindow('');
  };

  const joinQueue = async () => {
    if (!office) return;

    // Re-check against this office's own config client-side too — the
    // server re-verifies regardless, since a disabled option could still
    // be submitted directly.
    if (queueType === 'walkin' && !office.walkinEnabled) {
      Alert.alert('Error', 'Walk-in queueing is not available for this office.');
      return;
    }

    if (queueType === 'appointment' && !office.appointmentEnabled) {
      Alert.alert('Error', 'Appointments are not available for this office.');
      return;
    }

    if (!selectedDocuments.length) {
      Alert.alert('Error', 'Please select at least one document or service.');
      return;
    }

    if (queueType === 'appointment' && !appointmentSlipConfirmed) {
      Alert.alert('Error', 'Please confirm you have your Appointment Slip.');
      return;
    }

    if (office.priorityEnabled && priority && !priorityReason.trim()) {
      Alert.alert('Error', 'Please enter a reason for priority lane.');
      return;
    }

    try {
      setSubmitting(true);

      // Documents go out as { document_id, quantity } pairs (ported from
      // registrar-queue.tsx) instead of a flat id array, so each item
      // carries its own copy count.
      const docs = selectedDocuments.map((id) => ({
        document_id: id,
        quantity: quantities[id] || 1,
      }));

      const response = await fetch(`${API_BASE}/office-queue.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          office_id: office.id,
          type: queueType,
          appointment_slip_confirmed:
            queueType === 'appointment' ? appointmentSlipConfirmed : false,
          priority: office.priorityEnabled ? priority : false,
          priority_reason: office.priorityEnabled ? priorityReason : '',
          documents: docs,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Window + queue number now come back from the server (see
        // office-queue.php), same contract registrar-queue.tsx used.
        setQueueNumber(data.queue_number || '');
        setAssignedWindow(data.window_name || 'Not Assigned');
        setShowSuccessModal(true);
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to join queue');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step === 1) return;
    setStep(step - 1);
  };

  if (loadingOffice || !office) {
    return (
      <View style={styles.container}>
        <AppHeader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader title={`${office.name} Queue`} />

      <ScrollView contentContainerStyle={styles.content}>
        <StepIndicator current={step} />

        {step === 1 && (
          <QueueTypeStep
            queueType={queueType}
            setQueueType={setQueueType}
            walkinEnabled={office.walkinEnabled}
            appointmentEnabled={office.appointmentEnabled}
            onNext={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <DocumentStep
            documents={documents}
            selectedDocuments={selectedDocuments}
            setSelectedDocuments={setSelectedDocuments}
            quantities={quantities}
            setQuantities={setQuantities}
            priority={priority}
            setPriority={setPriority}
            priorityReason={priorityReason}
            setPriorityReason={setPriorityReason}
            priorityEnabled={office.priorityEnabled}
            onNext={() => setStep(3)}
            onBack={goBack}
          />
        )}

        {step === 3 && (
          <RequirementStep
            documents={documents}
            selectedDocuments={selectedDocuments}
            checkedRequirements={checkedRequirements}
            setCheckedRequirements={setCheckedRequirements}
            queueType={queueType}
            appointmentSlipConfirmed={appointmentSlipConfirmed}
            setAppointmentSlipConfirmed={setAppointmentSlipConfirmed}
            onNext={() => setStep(4)}
            onBack={goBack}
          />
        )}

        {step === 4 && (
          <ReviewStep
            queueType={queueType}
            appointmentSlipConfirmed={appointmentSlipConfirmed}
            documents={documents}
            selectedDocuments={selectedDocuments}
            quantities={quantities}
            priority={priority}
            priorityReason={priorityReason}
            onSubmit={joinQueue}
            onBack={goBack}
            submitting={submitting}
          />
        )}
      </ScrollView>

      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>You're in the queue!</Text>

            {!!queueNumber && (
              <Text style={styles.queueNumberText}>{queueNumber}</Text>
            )}

            <Text style={styles.modalLabel}>Assigned Counter</Text>
            <Text style={styles.windowText}>{assignedWindow}</Text>

            <Text style={styles.modalSubtitle}>
              Your request has been submitted to {office.name}.
            </Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSuccessModal(false);
                resetForm();
                router.replace('/student/home');
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 20,
    paddingBottom: 50,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  modalCard: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 10,
    textAlign: 'center',
  },

  queueNumberText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 12,
  },

  modalLabel: {
    fontSize: 13,
    color: COLORS.gray,
  },

  windowText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.secondary,
    marginTop: 4,
    marginBottom: 14,
  },

  modalSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 10,
  },

  modalButton: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },

  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});