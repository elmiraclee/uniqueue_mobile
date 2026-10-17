import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { API, API_URL } from '@/constants/backend';
import { fetchJsonOrNull, safeFetchJson } from '@/utils/api';
import AppHeader from '../../../components/layout/app-header';
import UnavailableServicesModal from '../../../components/queue/unavailable-services-modal';
import ServiceItemStep from '../../../components/queue-step/service-item-step';
import QueueTypeStep from '../../../components/queue-step/queue-type-step';
import RequirementStep from '../../../components/queue-step/requirement-step';
import { ChoiceMap } from '../../../components/queue-step/choice-step';
import { AcademicMap } from '../../../components/queue-step/academic-step';
import ReviewStep from '../../../components/queue-step/review-step';
import { COLORS } from '../../../constants/theme';

export interface ServiceItem {
  id: number;
  name: string;
  requirements: string[];
  category?: string;
  amount?: number | null;
  price?: number | null;
  pay_at_cashier?: boolean;
  use_academic_period?: boolean;
  has_choices?: boolean;
  choices?: { id: number; label: string; requirements?: string[] }[];
}

// ── OFFICE EVENT MODE ───────────────────────────────────────────────
// When ?event_id=NN is present, the student is walking through an
// office event (e.g. "Enrollment") instead of the regular walk-in/
// appointment form. Each step names its own service item(s) + requirement
// checklist and can route to a different office than the one the
// event was launched from.
export interface EventRequirement {
  id: number;
  service_item_id: number;
  requirement: string;
}

export interface EventStepServiceItem {
  service_item_id: number;
  quantity: number;
  name: string;
  requirements: EventRequirement[];
}

export interface EventStep {
  id: number;
  step_order: number;
  title: string;
  description: string | null;
  office_id: number;
  office_name: string;
  office_slug: string;
  service_items: EventStepServiceItem[];
  // Pure payment step linked to an earlier request step (web: "Requested at"
  // + "Amount to Pay" rows on the event confirm card).
  linked_source?: {
    office_name: string;
    queue_number: string;
    total: number;
    amount_complete: boolean;
    service_items?: { name: string; quantity: number; amount: number | null }[];
  } | null;
}

export interface EventInfo {
  id: number;
  office_id: number;
  name: string;
  description: string | null;
}

export interface ActiveEventTicket {
  id: number;
  queue_number: string;
  status: string;
  event_step_id: number;
  window_name: string | null;
}

export interface Office {
  id: number;
  name: string;
  slug: string;
  description?: string;
  walkinEnabled: boolean;
  appointmentEnabled: boolean;
  priorityEnabled: boolean;
  isFull?: boolean;
  dailyCapacity?: number | null;
  todayTicketCount?: number;
  transactionType?: string;
}

const API_BASE = API_URL;

const STEPS = [
  { label: 'Type' },
  { label: 'Details' },
  { label: 'Requirements' },
  { label: 'Confirm' },
];

/*
| Payment office (cashier) flow — mirrors web student-queue.php:
|   1. Pick walk-in or appointment
|   2. Pick which completed request you're paying for (+ priority)
| The regular service-item wizard never runs here; the cashier has no
| service items of its own to request.
*/
const CASHIER_STEPS = [
  { label: 'Type' },
  { label: 'Payment' },
];

function StepIndicator({
  current,
  steps = STEPS,
}: {
  current: number;
  steps?: { label: string }[];
}) {
  const visualIndex = current - 1;

  return (
    <View style={indicator.wrapper}>
      <View style={indicator.row}>
        {steps.map((step, i) => {
          const isDone = i < visualIndex;
          const isActive = i === visualIndex;

          return (
            <View
              key={i}
              style={[
                indicator.stepGroup,
                i < steps.length - 1 && indicator.stepGroupGrow,
              ]}
            >
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

              {i < steps.length - 1 && (
                <View
                  style={[indicator.line, isDone && indicator.lineDone]}
                />
              )}
            </View>
          );
        })}
      </View>

      <Text style={indicator.label}>{steps[visualIndex]?.label ?? ''}</Text>
    </View>
  );
}

const indicator = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },

  stepGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stepGroupGrow: {
    flex: 1,
  },

  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dotDone: {
    backgroundColor: '#22C55E',
  },

  dotActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#f5c5c8',
  },

  dotTodo: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#ddd',
  },

  dotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#bbb',
  },

  dotTextActive: {
    color: '#fff',
  },

  dotTextDone: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  line: {
    flex: 1,
    minWidth: 20,
    height: 2,
    backgroundColor: '#ddd',
    marginHorizontal: 6,
  },

  lineDone: {
    backgroundColor: '#22C55E',
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


  const {
    office: officeSlug,
    event_id: eventIdParam,
    forStudentId: forStudentIdParam,
    asParent: asParentParam,
    parentId: parentIdParam,
    childName: childNameParam,
  } = useLocalSearchParams<{
      office?: string;
      event_id?: string;
      forStudentId?: string;
      asParent?: string;
      parentId?: string;
      childName?: string;
    }>();
  const actingAsParent = asParentParam === '1' || asParentParam === 'true';
  const homePath = actingAsParent ? '/parent/home' : '/student/home';
  const [parentActorId, setParentActorId] = useState(0);

  const eventId = eventIdParam ? parseInt(eventIdParam, 10) : 0;
  const isEventMode = !!eventId;

  const [office, setOffice] = useState<Office | null>(null);
  // Web: "currently unavailable services" button (with count) next to the
  // office title, opening the request-a-service popup for this office.
  const [unavailableCount, setUnavailableCount] = useState(0);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [loadingOffice, setLoadingOffice] = useState(true);

  // Event-mode state
  const [loadingEvent, setLoadingEvent] = useState(isEventMode);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [eventSteps, setEventSteps] = useState<EventStep[]>([]);
  const [currentStep, setCurrentStep] = useState<EventStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);
  // Which step is being displayed — usually equal to currentStepIndex, but
  // moves independently when the student browses Back to a prior step.
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [eventCompleted, setEventCompleted] = useState(false);
  const [eventActiveTicket, setEventActiveTicket] = useState<ActiveEventTicket | null>(null);
  const [checkedEventReqIds, setCheckedEventReqIds] = useState<number[]>([]);

  // Mirrors of currentStepIndex/viewIndex for the silent background poll
  // below, so it always reads the latest values instead of a stale
  // closure captured when the interval was set up.
  const currentStepIndexRef = useRef<number | null>(null);
  const viewIndexRef = useRef<number | null>(null);
  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);
  useEffect(() => {
    viewIndexRef.current = viewIndex;
  }, [viewIndex]);

  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState(0);

  const [queueType, setQueueType] =
    useState<'walkin' | 'appointment'>('walkin');

  const [appointmentSlipConfirmed, setAppointmentSlipConfirmed] =
    useState(false);

  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [selectedServiceItems, setSelectedServiceItems] = useState<number[]>([]);
  const [checkedRequirements, setCheckedRequirements] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [itemChoices, setItemChoices] = useState<ChoiceMap>({});
  const [academicMap, setAcademicMap] = useState<AcademicMap>({});
  const [academicPeriods, setAcademicPeriods] = useState<{ id: number; label: string }[]>([]);
  const [schoolYears, setSchoolYears] = useState<{ id: number; school_year: string }[]>([]);

  const [priority, setPriority] = useState(false);
  const [priorityReason, setPriorityReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // Smart multi-queue / web parity extras.
  const [successMessage, setSuccessMessage] = useState('');
  const [successReserved, setSuccessReserved] = useState(false);
  const [hybridPayMode, setHybridPayMode] = useState(false);
  const [prequeueWarning, setPrequeueWarning] = useState<string | null>(null);
  const [possibleWindows, setPossibleWindows] = useState<string[]>([]);
  const [eventRequiresAcademic, setEventRequiresAcademic] = useState(false);
  const [eventPeriods, setEventPeriods] = useState<{ id: number; label: string }[]>([]);
  const [eventSchoolYears, setEventSchoolYears] = useState<{ id: number; school_year: string }[]>([]);
  const [eventPeriod, setEventPeriod] = useState('');
  const [eventSchoolYear, setEventSchoolYear] = useState('');

  // Which payable ticket the student picked in the cashier wizard.
  const [selectedPayableTicket, setSelectedPayableTicket] = useState<number | null>(
    null
  );

  // Payable tickets for the payment office (cashier flow).
  const [payableTickets, setPayableTickets] = useState<
    {
      ticket_id: number;
      queue_number: string;
      source_office_name: string;
      service_items: { id: number; name: string; amount: number | null; quantity: number }[];
      total: number;
      amount_complete: boolean;
    }[]
  >([]);
  const [payingTicketId, setPayingTicketId] = useState<number | null>(null);

  const [queueNumber, setQueueNumber] = useState('');
  const [assignedWindow, setAssignedWindow] = useState('');

  useEffect(() => {
    if (!officeSlug) {
      // No office selected — bounce back to the dashboard.
      Alert.alert('Error', 'No office selected.');
      router.replace(homePath as any);
      return;
    }

    loadUser();
    fetchOffice(officeSlug);
  }, [officeSlug]);

  useEffect(() => {
    if (!office) return;
    fetchServiceItems(office.id);
    fetchAcademicData(office.id);
  }, [office]);

  useEffect(() => {
    if (!office || !studentId) return;
    // Payables belong to the cashier queue ONLY — a request office must
    // never surface "pay at the cashier" items (web student-queue.php
    // only renders them inside the payment office).
    if (!['payment', 'hybrid'].includes(office.transactionType || '') || isEventMode) return;
    fetchPayableTickets(office.id, studentId);
  }, [office, studentId, isEventMode]);

  useEffect(() => {
    if (!isEventMode || !office || !studentId) return;
    fetchEventDetail();
  }, [isEventMode, office, studentId]);

  // Poll in the background while the student has an active ticket for
  // the current step, so the moment that ticket is served/completed and
  // the backend advances to the next step, this screen picks it up on
  // its own — no manual reload needed.
  useEffect(() => {
    if (!isEventMode || !office || !studentId) return;
    const ticketMatchesCurrentStep =
      !!eventActiveTicket && eventActiveTicket.event_step_id === currentStep?.id;
    if (!ticketMatchesCurrentStep || eventCompleted) return;

    const interval = setInterval(() => {
      fetchEventDetail({ silent: true });
    }, 4000);

    return () => clearInterval(interval);
  }, [isEventMode, office, studentId, eventActiveTicket, currentStep, eventCompleted]);

  const loadUser = async () => {
    const user = await AsyncStorage.getItem('user');
    if (user) {
      const parsed = JSON.parse(user);
      const role = await AsyncStorage.getItem('role');
      // Parent queueing for a child
      if ((actingAsParent || role === 'parent') && forStudentIdParam) {
        setStudentId(parseInt(String(forStudentIdParam), 10));
        setParentActorId(parentIdParam ? parseInt(String(parentIdParam), 10) : parsed.id);
      } else {
        setStudentId(parsed.id);
      }
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
        router.replace(homePath as any);
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
        isFull: !!o.is_full,
        dailyCapacity: o.daily_capacity ?? null,
        todayTicketCount: o.today_ticket_count ?? 0,
        transactionType: o.transaction_type ?? 'request',
      });

      // Today's availability + parent-queue setting (web validate_queue_join_gate).
      if (!o.is_full && actingAsParent && o.parent_queue_enabled === false) {
        Alert.alert('Not available', 'This office does not accept parent/guardian queueing.', [
          { text: 'OK', onPress: () => router.replace(homePath as any) },
        ]);
      } else if (!o.is_full && o.can_join === false) {
        Alert.alert('Not accepting queues', o.availability_reason || 'This office is not accepting queues right now.', [
          { text: 'OK', onPress: () => router.replace(homePath as any) },
        ]);
      }

      if (o.is_full) {
        Alert.alert(
          'Office Full',
          'This office has reached its full capacity for today. Please try again tomorrow.',
          [{ text: 'OK', onPress: () => router.replace(homePath as any) }]
        );
      }

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
      router.replace(homePath as any);
    } finally {
      setLoadingOffice(false);
    }
  };

  // SERVICE ITEMS — scoped to this office only, and used by both queue types.
  const fetchAcademicData = async (officeId: number) => {
    try {
      const data = await fetchJsonOrNull(API.getAcademicData, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office_id: officeId }),
      });
      if (data?.success) {
        // Respect the office master toggle (office_configs.academic_period_enabled).
        // Older API builds don't return the flag — treat those as enabled.
        const enabled =
          data.academic_period_enabled === undefined ||
          data.academic_period_enabled === null ||
          Number(data.academic_period_enabled) === 1;

        setAcademicPeriods(enabled ? data.periods || [] : []);
        setSchoolYears(enabled ? data.school_years || [] : []);
      }
    } catch (e) {
      console.log('Academic data error', e);
    }
  };

  const fetchServiceItems = async (officeId: number) => {
    try {
      const data = await fetchJsonOrNull(
        `${API_BASE}/get_service_items.php?office_id=${officeId}`
      );
      if (data.success) {
        setServiceItems(data.service_items);
      }
    } catch (error) {
      console.log(error);
    }
  };

  // A payment office is the cashier: it never lists its own service
  // items, only the completed requests waiting to be paid.
  const isPaymentOffice =
    office?.transactionType === 'payment' || (office?.transactionType === 'hybrid' && hybridPayMode);

  // Body fields that tell the API a parent is acting for a linked child.
  const actorFields = () =>
    parentActorId > 0
      ? { created_by_role: 'parent', created_by_parent_id: parentActorId, parent_id: parentActorId, child_id: studentId }
      : {};
  const actorQuery = () => (parentActorId > 0 ? `&parent_id=${parentActorId}&child_id=${studentId}` : '');

  /** Smart multi-queue gate (web prequeue-check.php). Returns a reason when blocked. */
  const runPrequeueCheck = async (svcIds: number[], type: string): Promise<string | null> => {
    if (!office) return null;
    try {
      const pre = await fetchJsonOrNull(
        `${API.prequeueCheck}?student_id=${studentId}${actorQuery()}&office_id=${office.id}&type=${type}&svc_ids=${svcIds.join(',')}`,
      );
      if (pre?.success && pre.allowed === false) {
        return (pre.reason || 'You cannot join this queue yet.') + (pre.retry_at ? ` Try again around ${pre.retry_at}.` : '');
      }
    } catch {}
    return null;
  };

  const showJoinSuccess = (data: any) => {
    setQueueNumber(data.queue_number || '');
    setAssignedWindow(data.window_name || 'Not Assigned');
    setSuccessReserved(!!data.reserved || data.status === 'reserved');
    setSuccessMessage(data.message || '');
    setShowSuccessModal(true);
  };

  const fetchPayableTickets = async (officeId: number, sid: number) => {
    try {
      const data = await fetchJsonOrNull(
        `${API.getPayableTickets}?student_id=${sid}&office_id=${officeId}${actorQuery()}`
      );
      if (data.success) {
        setPayableTickets(data.payable_tickets || []);
      }
    } catch (error) {
      console.log('Fetch payable tickets error:', error);
    }
  };

  const submitCashierPayment = async (sourceTicketId: number) => {
    if (!office || !studentId) return;
    if (office.isFull) {
      Alert.alert('Office Full', 'This office has reached its full capacity for today.');
      return;
    }

    // Web parity: smart multi-queue gate instead of a hard one-ticket block.
    const cashierBlock = await runPrequeueCheck([], queueType || 'walkin');
    if (cashierBlock) {
      Alert.alert('Cannot join yet', cashierBlock);
      return;
    }

    setPayingTicketId(sourceTicketId);
    try {
      const response = await fetch(`${API_BASE}/office-queue.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'cashier',
          student_id: studentId,
          office_id: office.id,
          type: queueType || 'walkin',
          source_ticket_id: sourceTicketId,
          priority: office.priorityEnabled ? priority : false,
          priority_reason: office.priorityEnabled ? priorityReason : '',
          ...actorFields(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        showJoinSuccess(data);
        setPayableTickets((prev) =>
          prev.filter((t) => t.ticket_id !== sourceTicketId)
        );
        setSelectedPayableTicket(null);
      } else {
        Alert.alert('Unable to join', data.message || 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not join payment queue.');
    } finally {
      setPayingTicketId(null);
    }
  };

  // Web parity: warn early (after service selection) and preview which
  // counters could serve the selection, like student-queue.php does.
  useEffect(() => {
    if (!office || !studentId || isEventMode || isPaymentOffice) return;
    if (!selectedServiceItems.length) {
      setPrequeueWarning(null);
      setPossibleWindows([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const reason = await runPrequeueCheck(selectedServiceItems, queueType);
      if (!cancelled) setPrequeueWarning(reason);
      try {
        const w = await fetchJsonOrNull(
          `${API.getPossibleWindows}?office_id=${office.id}&type=${queueType}&svc_ids=${selectedServiceItems.join(',')}`,
        );
        if (!cancelled) setPossibleWindows((w?.windows || []).map((x: any) => x.name));
      } catch {}
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office?.id, studentId, selectedServiceItems, queueType, isEventMode, isPaymentOffice]);

  const fetchEventDetail = async (opts: { silent?: boolean } = {}) => {
    if (!office) return;
    const silent = !!opts.silent;

    try {
      if (!silent) setLoadingEvent(true);

      const data = await fetchJsonOrNull(
        `${API_BASE}/office-queue.php?action=event&event_id=${eventId}&office_id=${office.id}&student_id=${studentId}${actorQuery()}`
      );

      if (!data.success) {
        if (!silent) {
          Alert.alert('Error', data.message || 'This event is not available.');
          router.replace(homePath as any);
        }
        return;
      }

      const prevCurrentStepIndex = currentStepIndexRef.current;
      const prevViewIndex = viewIndexRef.current;
      const nextCurrentStepIndex = data.current_step_index;
      const stepAdvanced = prevCurrentStepIndex !== nextCurrentStepIndex;

      setEventInfo(data.event);
      setEventSteps(data.steps || []);
      setCurrentStep(data.current_step);
      setCurrentStepIndex(nextCurrentStepIndex);
      setEventCompleted(!!data.event_completed);
      setEventActiveTicket(data.active_ticket);
      setEventRequiresAcademic(!!data.current_step_requires_academic);
      if (data.current_step_requires_academic) {
        const stepOfficeId = Number(data.current_step?.office_id || office.id);
        fetchJsonOrNull(API.getAcademicData, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ office_id: stepOfficeId }),
        }).then((ac) => {
          if (ac?.success) {
            setEventPeriods(ac.periods || []);
            setEventSchoolYears(ac.school_years || []);
          }
        });
      }

      // Auto-follow the student's view forward when their current-step
      // ticket completes and the event moves on. If they'd browsed away
      // to another step, leave their view alone — don't yank them back.
      const wasViewingCurrent =
        prevViewIndex === null ||
        prevCurrentStepIndex === null ||
        prevViewIndex === prevCurrentStepIndex;

      if (!silent || wasViewingCurrent) {
        setViewIndex(nextCurrentStepIndex);
      }

      if (!silent || stepAdvanced) {
        setCheckedEventReqIds([]);
      }
    } catch (error) {
      console.log(error);
      if (!silent) {
        Alert.alert('Error', 'Unable to load this event right now.');
        router.replace(homePath as any);
      }
    } finally {
      if (!silent) setLoadingEvent(false);
    }
  };

  const toggleEventRequirement = (id: number) => {
    setCheckedEventReqIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  // The step currently being displayed — may be an earlier step the
  // student is browsing back to, not necessarily the one they can submit.
  const viewStep = viewIndex !== null ? eventSteps[viewIndex] ?? currentStep : currentStep;
  useEffect(() => {
    if (!office?.id || !studentId) return;
    let cancelled = false;
    fetchJsonOrNull(API.getUnavailableServices, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, office_id: office.id }),
    }).then((res) => {
      if (!cancelled) setUnavailableCount(res?.success ? (res.services || []).length : 0);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [office?.id, studentId]);

  const isViewingCurrentStep =
    viewIndex === null || currentStepIndex === null || viewIndex === currentStepIndex;

  // True when browsing a step that hasn't been reached yet — separate
  // from browsing back to an earlier, already-passed step — so the UI
  // can explain why joining is locked instead of just hiding the button.
  const isFutureStep =
    viewIndex !== null && currentStepIndex !== null && viewIndex > currentStepIndex;

  // Whether the Back button should render — purely a function of position
  // in the list, independent of join/ticket state, so it always works
  // whenever there's somewhere to go back to.
  const canGoBackEventStep = viewIndex !== null && viewIndex > 0;

  // Whether there's a next step to browse forward into — the last step
  // in the sequence has nowhere further to go, so the Next button
  // shouldn't render there.
  const canGoNextEventStep =
    viewIndex !== null && !!eventSteps[viewIndex + 1];

  // The Join button only makes sense on the current step. If a ticket's
  // already been submitted for it, it stays as the Join button — shown
  // disabled — instead of turning into Next when there's nowhere further
  // to go (i.e. this is the last step in the sequence).
  //
  // Guard: only treat eventActiveTicket as blocking THIS step if it's
  // actually tied to it (event_step_id matches). Otherwise a leftover
  // ticket from an earlier, already-finished step would incorrectly make
  // the current step look already-queued (checkboxes pre-checked, Join
  // disabled) before the student has done anything here.
  const isActiveTicketForCurrentStep =
    !!eventActiveTicket && eventActiveTicket.event_step_id === currentStep?.id;

  const showJoinEventButton =
    isViewingCurrentStep && (!isActiveTicketForCurrentStep || !canGoNextEventStep);
  const showNextEventButton = !showJoinEventButton && canGoNextEventStep;

  // Requirements can only be ticked/unticked on the current step, and
  // only before a ticket has been submitted for it.
  const canEditEventRequirements = isViewingCurrentStep && !isActiveTicketForCurrentStep;

  // A step counts as "done" (requirements shown pre-checked + locked)
  // once its ticket is queued (current step) or it's already behind us
  // (a past step). A future step is neither done nor editable yet.
  const isDoneEventStep =
    (!isViewingCurrentStep && !isFutureStep) ||
    (isViewingCurrentStep && isActiveTicketForCurrentStep);

  // Step back to the previous step in this event's sequence (view-only —
  // does not undo an already-submitted ticket for that step).
  const goToPreviousEventStep = () => {
    if (viewIndex === null || viewIndex <= 0) return;
    const prevIndex = viewIndex - 1;
    if (!eventSteps[prevIndex]) return;

    setViewIndex(prevIndex);
    setCheckedEventReqIds([]);
  };

  // Step forward through the sequence — the student can browse ahead
  // to preview later steps, but can only ever join the queue while
  // viewIndex === currentStepIndex (see canJoinEventQueue below).
  const goToNextEventStep = () => {
    if (viewIndex === null) return;
    const nextIndex = viewIndex + 1;
    if (!eventSteps[nextIndex]) return;

    setViewIndex(nextIndex);
    setCheckedEventReqIds([]);
  };

  // Every requirement across every service item this step needs — the
  // student must check all of them before joining, mirrored server-
  // side in office-queue.php since this guard can be bypassed.
  const stepRequirementIds = (viewStep?.service_items ?? []).flatMap((item) =>
    (item.requirements ?? []).map((r) => r.id)
  );
  const allEventRequirementsChecked =
    stepRequirementIds.length === 0 ||
    stepRequirementIds.every((id) => checkedEventReqIds.includes(id));

  // Gate the Join Queue button until requirements are checked and,
  // if priority is toggled on, a reason has been entered. Also blocked
  // while the student already has an active ticket for this step.
  const canJoinEventQueue =
    isViewingCurrentStep &&
    !isActiveTicketForCurrentStep &&
    allEventRequirementsChecked &&
    (!priority || priorityReason.trim().length > 0) &&
    (!eventRequiresAcademic || (!!eventPeriod && !!eventSchoolYear)) &&
    !submitting;

  const joinEventQueue = async () => {
    if (!currentStep) return;

    if (isActiveTicketForCurrentStep) {
      Alert.alert('Error', 'You already have an active queue for this step.');
      return;
    }

    if (office?.priorityEnabled && priority && !priorityReason.trim()) {
      Alert.alert('Error', 'Please enter a reason for priority lane.');
      return;
    }

    if (!allEventRequirementsChecked) {
      Alert.alert('Error', 'Please confirm all requirements are met before joining the queue.');
      return;
    }

    if (eventRequiresAcademic && (!eventPeriod || !eventSchoolYear)) {
      Alert.alert('Error', 'Please choose the academic period and school year for this step.');
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`${API_BASE}/office-queue.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'event',
          student_id: studentId,
          event_id: eventId,
          event_step_id: currentStep.id,
          priority: office?.priorityEnabled ? priority : false,
          priority_reason: office?.priorityEnabled ? priorityReason : '',
          req_check: checkedEventReqIds,
          ...(eventRequiresAcademic ? { academic_period: eventPeriod, school_year: eventSchoolYear } : {}),
          ...actorFields(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setQueueNumber(data.queue_number || '');
        setAssignedWindow(data.window_name || 'Not Assigned');
        setSuccessReserved(!!data.reserved || data.status === 'reserved');
        setSuccessMessage(data.message || '');

        // Refresh immediately so eventActiveTicket/currentStep reflect
        // the ticket we just created right away — otherwise the Join
        // button and banner would keep showing the pre-join state
        // until the next 8s poll (or a manual reload) picks it up.
        await fetchEventDetail({ silent: true });
        setPriority(false);
        setPriorityReason('');

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

  const resetForm = () => {
    setStep(1);
    setQueueType('walkin');
    setAppointmentSlipConfirmed(false);
    setSelectedServiceItems([]);
    setCheckedRequirements([]);
    setQuantities({});
    setItemChoices({});
    setAcademicMap({});
    setPriority(false);
    setPriorityReason('');
    setQueueNumber('');
    setAssignedWindow('');
  };


  const selectedNeedChoices = serviceItems.filter(
    (i) => selectedServiceItems.includes(i.id) && (i.has_choices || (i.choices && i.choices.length > 0))
  );
  const selectedNeedAcademic = serviceItems.filter(
    (i) => selectedServiceItems.includes(i.id) && i.use_academic_period
  );

  const joinQueue = async () => {
    if (!office) return;

    if (queueType === 'walkin' && !office.walkinEnabled) {
      Alert.alert('Error', 'Walk-in queueing is not available for this office.');
      return;
    }

    if (queueType === 'appointment' && !office.appointmentEnabled) {
      Alert.alert('Error', 'Appointments are not available for this office.');
      return;
    }

    if (!selectedServiceItems.length) {
      Alert.alert('Error', 'Please select at least one service item or service.');
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

    const gate = await runPrequeueCheck(selectedServiceItems, queueType);
    if (gate) {
      Alert.alert('Cannot join yet', gate);
      return;
    }

    try {
      setSubmitting(true);

      const items = selectedServiceItems.map((id) => {
        const entry: any = {
          service_item_id: id,
          quantity: quantities[id] || 1,
        };
        if (itemChoices[id]) {
          entry.choice_id = itemChoices[id].choice_id;
          entry.choice_label = itemChoices[id].choice_label;
        }
        if (academicMap[id]?.length) {
          // Only send as many copies as the student actually asked for —
          // the map can still hold rows from a higher earlier quantity.
          entry.academic = academicMap[id].slice(0, quantities[id] || 1).map((a) => ({
            period: a.period,
            academic_period: a.period,
            school_year: a.school_year,
          }));
        }
        return entry;
      });

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
          service_items: items,
          ...actorFields(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        showJoinSuccess(data);
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

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUser();
      const slug = office?.slug || (typeof officeSlug !== 'undefined' ? String(officeSlug) : null);
      if (slug) await fetchOffice(slug);
      if (office?.id) {
        await fetchServiceItems(office.id);
        if (studentId) await fetchPayableTickets(office.id, studentId);
      }
      if (isEventMode) await fetchEventDetail();
    } finally {
      setRefreshing(false);
    }
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
      <AppHeader title={isEventMode ? (eventInfo?.name ?? 'Event Queue') : `${office.name} Queue`} />

      {actingAsParent && (
        <View style={styles.childBanner}>
          <Text style={styles.childBannerText}>
            Queue for <Text style={{ fontWeight: '800' }}>{childNameParam || 'your child'}</Text>
          </Text>
        </View>
      )}

      {unavailableCount > 0 && (
        <TouchableOpacity style={styles.uvBtn} onPress={() => setShowUnavailable(true)}>
          <Text style={styles.uvBtnText}>
            ⓘ {unavailableCount} currently unavailable {unavailableCount === 1 ? 'service' : 'services'} · Request
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {isEventMode ? (
          loadingEvent ? (
            <View style={styles.eventLoadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : eventCompleted ? (
            <View style={styles.eventCard}>
              <Text style={styles.eventCardStepTitle}>All steps completed 🎉</Text>
              <Text style={styles.eventCardDescription}>
                You've finished every step of {eventInfo?.name}.
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => router.replace(homePath as any)}
              >
                <Text style={styles.modalButtonText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          ) : currentStep ? (
            <View style={styles.eventCard}>
              <Text style={styles.eventCardName}>{eventInfo?.name}</Text>
              {!!eventInfo?.description && (
                <Text style={styles.eventCardDescription}>{eventInfo.description}</Text>
              )}

              {isViewingCurrentStep && isActiveTicketForCurrentStep && (
                <View style={styles.eventStepBadge}>
                  <Text style={styles.eventStepBadgeText}>Current Step Ongoing</Text>
                </View>
              )}

              {isFutureStep && (
                <View style={styles.eventStepBadge}>
                  <Text style={styles.eventStepBadgeText}>Complete the Current Queue</Text>
                </View>
              )}

              {!isViewingCurrentStep && !isFutureStep && (
                <View style={styles.eventStepBadgeFinished}>
                  <Text style={styles.eventStepBadgeTextFinished}>Finished Queue</Text>
                </View>
              )}

              <StepIndicator
                current={(viewIndex ?? currentStepIndex ?? 0) + 1}
                steps={eventSteps.map((s) => ({ label: s.title }))}
              />

              <Text style={styles.eventCardStepTitle}>{viewStep?.title}</Text>
              {!!viewStep?.description && (
                <Text style={styles.eventCardDescription}>{viewStep.description}</Text>
              )}
              <Text style={styles.eventCardOffice}>at {viewStep?.office_name}</Text>

              {isViewingCurrentStep && !!currentStep?.linked_source && (
                <View style={styles.linkedBox}>
                  <View style={styles.linkedRow}>
                    <Text style={styles.linkedLabel}>Requested at</Text>
                    <Text style={styles.linkedValue}>
                      {currentStep.linked_source.office_name} · Queue #{currentStep.linked_source.queue_number}
                    </Text>
                  </View>
                  {(currentStep.linked_source.service_items ?? []).map((it, i) => (
                    <Text key={`${it.name}-${i}`} style={styles.linkedItem}>
                      • {it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ''}
                    </Text>
                  ))}
                  <View style={styles.linkedRow}>
                    <Text style={styles.linkedLabel}>Amount to Pay</Text>
                    <Text style={styles.linkedValue}>
                      {currentStep.linked_source.amount_complete
                        ? `₱${Number(currentStep.linked_source.total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : 'Amount to be confirmed'}
                    </Text>
                  </View>
                </View>
              )}

              {!isViewingCurrentStep && !isFutureStep && (
                <Text style={styles.eventDocNoReq}>
                  Viewing a previous step. Tap Next to return to your current step.
                </Text>
              )}

              {!!viewStep && viewStep.service_items.length > 0 && (
                <View style={styles.eventDocsBox}>
                  <Text style={styles.eventDocsLabel}>Please confirm you have these ready</Text>

                  {viewStep.service_items.map((item) => (
                    <View key={item.service_item_id} style={styles.eventDocGroup}>
                      <Text style={styles.eventDocName}>
                        {item.name}
                        {item.quantity > 1 ? ` (x${item.quantity})` : ''}
                      </Text>

                      {(item.requirements ?? []).length === 0 ? (
                        <Text style={styles.eventDocNoReq}>No additional requirements.</Text>
                      ) : (
                        item.requirements.map((req) => {
                          const checked = canEditEventRequirements
                            ? checkedEventReqIds.includes(req.id)
                            : isDoneEventStep;
                          return (
                            <TouchableOpacity
                              key={req.id}
                              style={styles.eventReqRow}
                              activeOpacity={canEditEventRequirements ? 0.7 : 1}
                              disabled={!canEditEventRequirements}
                              onPress={() => toggleEventRequirement(req.id)}
                            >
                              <View
                                style={[
                                  styles.eventCheckbox,
                                  checked && styles.eventCheckboxChecked,
                                  !canEditEventRequirements && styles.eventCheckboxDisabled,
                                ]}
                              >
                                {checked && <Text style={styles.eventCheckMark}>✓</Text>}
                              </View>
                              <Text style={styles.eventReqText}>{req.requirement}</Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  ))}
                </View>
              )}

              {isViewingCurrentStep && office.priorityEnabled && (
                <View style={styles.eventPriorityBox}>
                  <TouchableOpacity
                    style={styles.eventReqRow}
                    activeOpacity={0.7}
                    onPress={() => setPriority(!priority)}
                  >
                    <View
                      style={[styles.eventCheckbox, priority && styles.eventCheckboxChecked]}
                    >
                      {priority && <Text style={styles.eventCheckMark}>✓</Text>}
                    </View>
                    <Text style={styles.eventReqText}>
                      Priority Lane (PWD, pregnant, or senior citizen)
                    </Text>
                  </TouchableOpacity>

                  {priority && (
                    <TextInput
                      style={styles.eventPriorityInput}
                      placeholder="Reason for priority"
                      placeholderTextColor={COLORS.gray}
                      value={priorityReason}
                      onChangeText={setPriorityReason}
                    />
                  )}
                </View>
              )}

              {isViewingCurrentStep && eventRequiresAcademic && !isActiveTicketForCurrentStep && (
                <View style={styles.eventPriorityBox}>
                  <Text style={styles.eventReqText}>Academic period *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                    {eventPeriods.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setEventPeriod(p.label)}
                        style={[styles.parityChip, eventPeriod === p.label && styles.parityChipOn]}
                      >
                        <Text style={[styles.parityChipText, eventPeriod === p.label && { color: '#fff' }]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.eventReqText}>School year *</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {eventSchoolYears.map((y) => (
                      <TouchableOpacity
                        key={y.id}
                        onPress={() => setEventSchoolYear(y.school_year)}
                        style={[styles.parityChip, eventSchoolYear === y.school_year && styles.parityChipOn]}
                      >
                        <Text style={[styles.parityChipText, eventSchoolYear === y.school_year && { color: '#fff' }]}>
                          {y.school_year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.eventStepActions}>
                {showJoinEventButton ? (
                  <TouchableOpacity
                    style={[styles.eventNextButton, !canJoinEventQueue && styles.eventSubmitButtonDisabled]}
                    disabled={!canJoinEventQueue}
                    onPress={joinEventQueue}
                  >
                    <Text style={styles.modalButtonText}>
                      {submitting ? 'Joining…' : 'Confirm & Join Queue'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  showNextEventButton && (
                    <TouchableOpacity
                      style={styles.eventNextButton}
                      onPress={goToNextEventStep}
                    >
                      <Text style={styles.modalButtonText}>Next</Text>
                    </TouchableOpacity>
                  )
                )}
                {canGoBackEventStep && (
                  <TouchableOpacity
                    style={styles.eventBackButton}
                    onPress={goToPreviousEventStep}
                  >
                    <Text style={styles.eventBackButtonText}>Back</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.eventCard}>
              <Text style={styles.eventCardStepTitle}>No steps configured for this event.</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => router.replace(homePath as any)}
              >
                <Text style={styles.modalButtonText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
        <>
        {isPaymentOffice ? (
          /* ── CASHIER FLOW (payment office) ───────────────────────────
             Step 1 pick walk-in / appointment, step 2 pick what to pay
             for — exactly the two-step wizard the web shows. */
          <>
            {office.transactionType === 'hybrid' && (
              <TouchableOpacity style={styles.parityBanner} onPress={() => { setHybridPayMode(false); setStep(1); }}>
                <Text style={styles.parityBannerText}>‹ Back to requesting a service</Text>
              </TouchableOpacity>
            )}
            <StepIndicator current={step > 2 ? 2 : step} steps={CASHIER_STEPS} />

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
              <View>
                {payableTickets.length === 0 ? (
                  <View
                    style={[
                      styles.payableSection,
                      { backgroundColor: '#f5f5f5', borderColor: '#e5e5e5' },
                    ]}
                  >
                    <Text style={styles.payableTitle}>Nothing to pay yet</Text>
                    <Text style={styles.payableSubtitle}>
                      You have no completed service requests waiting for payment
                      right now. Once an office marks your request as completed,
                      it will show up here.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.payableSection}>
                    <Text style={styles.payableTitle}>
                      Select what you&apos;re paying for
                    </Text>
                    <Text style={styles.payableSubtitle}>
                      These are your completed service requests from other
                      offices, ready for payment.
                    </Text>

                    {payableTickets.map((ticket) => {
                      const selected = selectedPayableTicket === ticket.ticket_id;
                      return (
                        <TouchableOpacity
                          key={ticket.ticket_id}
                          activeOpacity={0.8}
                          onPress={() => setSelectedPayableTicket(ticket.ticket_id)}
                          style={[
                            styles.payableCard,
                            selected && styles.payableCardSelected,
                          ]}
                        >
                          <View style={styles.payableCardHeader}>
                            <Text style={styles.payableQueueNum}>
                              #{ticket.queue_number}
                            </Text>
                            <Text style={styles.payableOffice} numberOfLines={1}>
                              {ticket.source_office_name}
                            </Text>
                          </View>
                          {ticket.service_items.map((si) => (
                            <Text key={si.id} style={styles.payableItem}>
                              {si.name}
                              {si.quantity > 1 ? ` ×${si.quantity}` : ''}
                              {si.amount != null
                                ? ` — ₱${(si.amount * si.quantity).toFixed(2)}`
                                : ' — Amount to be confirmed'}
                            </Text>
                          ))}
                          <Text style={styles.payableTotal}>
                            {ticket.amount_complete
                              ? `Total: ₱${ticket.total.toFixed(2)}`
                              : 'Total: Amount to be confirmed'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    {office.priorityEnabled && (
                      <View style={styles.eventPriorityBox}>
                        <TouchableOpacity
                          style={styles.eventReqRow}
                          activeOpacity={0.7}
                          onPress={() => setPriority(!priority)}
                        >
                          <View
                            style={[
                              styles.eventCheckbox,
                              priority && styles.eventCheckboxChecked,
                            ]}
                          >
                            {priority && <Text style={styles.eventCheckMark}>✓</Text>}
                          </View>
                          <Text style={styles.eventReqText}>
                            Priority Lane (PWD, pregnant, or senior citizen)
                          </Text>
                        </TouchableOpacity>

                        {priority && (
                          <TextInput
                            style={styles.eventPriorityInput}
                            placeholder="Reason for priority"
                            placeholderTextColor={COLORS.gray}
                            value={priorityReason}
                            onChangeText={setPriorityReason}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.cashierActions}>
                  <TouchableOpacity
                    style={styles.eventBackButton}
                    onPress={() => setStep(1)}
                  >
                    <Text style={styles.eventBackButtonText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.payablePayButton,
                      styles.cashierPayButton,
                      (!selectedPayableTicket ||
                        payingTicketId !== null ||
                        !!office.isFull) &&
                        styles.payablePayButtonDisabled,
                    ]}
                    disabled={
                      !selectedPayableTicket ||
                      payingTicketId !== null ||
                      !!office.isFull
                    }
                    onPress={() =>
                      selectedPayableTicket &&
                      submitCashierPayment(selectedPayableTicket)
                    }
                  >
                    <Text style={styles.payablePayButtonText}>
                      {payingTicketId !== null ? 'Joining…' : 'Join Payment Queue'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : (
          <>
        {office.transactionType === 'hybrid' && payableTickets.length > 0 && step === 1 && (
          <TouchableOpacity style={styles.parityBanner} onPress={() => { setHybridPayMode(true); setStep(1); }}>
            <Text style={styles.parityBannerText}>
              Pay for a completed request instead ({payableTickets.length}) ›
            </Text>
          </TouchableOpacity>
        )}
        {!!prequeueWarning && (
          <View style={[styles.parityBanner, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Text style={[styles.parityBannerText, { color: '#92400e' }]}>{prequeueWarning}</Text>
          </View>
        )}
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
          <ServiceItemStep
            service_items={serviceItems}
            selectedServiceItems={selectedServiceItems}
            setSelectedServiceItems={setSelectedServiceItems}
            quantities={quantities}
            setQuantities={setQuantities}
            priority={priority}
            setPriority={setPriority}
            priorityReason={priorityReason}
            setPriorityReason={setPriorityReason}
            priorityEnabled={office.priorityEnabled}
            itemChoices={itemChoices}
            setItemChoices={setItemChoices}
            academic={academicMap}
            setAcademic={setAcademicMap}
            periods={academicPeriods}
            schoolYears={schoolYears}
            onNext={() => setStep(3)}
            onBack={goBack}
          />
        )}

        {step === 3 && (
          <RequirementStep
            service_items={serviceItems}
            selectedServiceItems={selectedServiceItems}
            checkedRequirements={checkedRequirements}
            setCheckedRequirements={setCheckedRequirements}
            queueType={queueType}
            appointmentSlipConfirmed={appointmentSlipConfirmed}
            setAppointmentSlipConfirmed={setAppointmentSlipConfirmed}
            itemChoices={itemChoices}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && possibleWindows.length > 0 && (
          <View style={styles.parityBanner}>
            <Text style={styles.parityBannerText}>
              Possible counter{possibleWindows.length > 1 ? 's' : ''}: {possibleWindows.join(', ')}
            </Text>
          </View>
        )}
        {step === 4 && (
          <ReviewStep
            queueType={queueType}
            appointmentSlipConfirmed={appointmentSlipConfirmed}
            service_items={serviceItems}
            selectedServiceItems={selectedServiceItems}
            quantities={quantities}
            priority={priority}
            priorityReason={priorityReason}
            onSubmit={joinQueue}
            onBack={goBack}
            submitting={submitting}
          />
        )}
          </>
        )}
        </>
        )}
      </ScrollView>

      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {successReserved ? 'Queue reserved!' : isEventMode ? "Step joined!" : "You're in the queue!"}
            </Text>

            {!!queueNumber && (
              <Text style={styles.queueNumberText}>{queueNumber}</Text>
            )}

            <Text style={styles.modalLabel}>Assigned Counter</Text>
            <Text style={styles.windowText}>{assignedWindow}</Text>

            {successReserved && !!successMessage && (
              <Text style={[styles.modalSubtitle, { color: '#b45309' }]}>{successMessage}</Text>
            )}

            <Text style={styles.modalSubtitle}>
              {isEventMode
                ? `Your request for "${currentStep?.title ?? 'this step'}" has been submitted to ${currentStep?.office_name ?? eventInfo?.name}.`
                : `Your request has been submitted to ${office.name}.`}
            </Text>

            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSuccessModal(false);
                setSuccessReserved(false);
                setSuccessMessage('');
                resetForm();
                router.replace(homePath as any);
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <UnavailableServicesModal
        visible={showUnavailable}
        onClose={() => setShowUnavailable(false)}
        studentId={studentId}
        parentId={actingAsParent ? parentActorId : undefined}
        officeId={office.id}
        childName={actingAsParent ? childNameParam : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  childBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary + '12',
  },
  childBannerText: { color: COLORS.primary, textAlign: 'center' },
  uvBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  uvBtnText: { color: COLORS.primary, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  linkedBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    gap: 4,
  },
  linkedRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  linkedLabel: { color: COLORS.gray, fontSize: 12 },
  linkedValue: { flexShrink: 1, textAlign: 'right', fontWeight: '700', color: COLORS.text, fontSize: 13 },
  linkedItem: { fontSize: 12, color: COLORS.text },

  parityBanner: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  parityBannerText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  parityChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
  parityChipOn: { backgroundColor: COLORS.primary },
  parityChipText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
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

  payableSection: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: '#F5D78E',
  },
  payableTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  payableSubtitle: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 12,
  },
  payableCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    backgroundColor: COLORS.primarySoft,
  },
  cashierPayButton: {
    flex: 1,
  },
  cashierActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  payableCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  payableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  payableQueueNum: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  payableOffice: {
    fontSize: 12,
    color: COLORS.gray,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  payableItem: {
    fontSize: 13,
    color: COLORS.secondary,
    marginBottom: 2,
  },
  payableTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 6,
  },
  payablePayButton: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  payablePayButtonDisabled: {
    opacity: 0.6,
  },
  payablePayButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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

  // ── Event mode ──
  eventLoadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },

  eventActiveTicketBanner: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
    alignItems: 'center',
  },

  eventActiveTicketLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 6,
    textAlign: 'center',
  },

  eventCardName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 4,
  },

  eventCardDescription: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 10,
    lineHeight: 19,
  },

  eventStepBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },

  eventStepBadgeFinished: {
    alignSelf: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },

  eventStepBadgeTextFinished: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22C55E',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  eventStepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  eventCardStepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 2,
  },

  eventCardOffice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 16,
  },

  eventDocsBox: {
    marginBottom: 16,
  },

  eventDocsLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 10,
  },

  eventDocGroup: {
    marginBottom: 14,
  },

  eventDocName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 6,
  },

  eventDocNoReq: {
    fontSize: 12,
    color: COLORS.gray,
    fontStyle: 'italic',
  },

  eventReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },

  eventCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  eventCheckboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  eventCheckboxDisabled: {
    opacity: 0.6,
  },

  eventCheckMark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  eventReqText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  eventPriorityBox: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },

  eventPriorityInput: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.secondary,
  },

  eventSubmitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },

  eventSubmitButtonDisabled: {
    opacity: 0.6,
  },

  eventStepActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },

  eventBackButton: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  eventBackButtonText: {
    color: COLORS.secondary,
    fontSize: 15,
    fontWeight: '700',
  },

  eventNextButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  eventReviewCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    marginBottom: 8,
  },

  eventReviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  modalRowLast: {
    borderBottomWidth: 0,
  },

  eventReviewValue: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 13,
  },
});