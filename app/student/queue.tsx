import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API } from '@/constants/backend';
import AppHeader from '../../components/layout/app-header';
import { COLORS } from '../../constants/theme';

interface Transaction {
  id: number;
  queue_number: string;

  office_name: string;
  window_name: string | null;

  service_items: string;
  event_name: string | null;

  status: string;
  type: string;

  priority: number;
  priority_reason: string;

  created_at: string;
  transaction_date: string;
  transaction_time: string;

  // Star rating (1-5) the student gave this transaction, or null if
  // it's completed but hasn't been rated yet.
  feedback_rating: number | null;
}

// Renders a row of 5 stars, filling in `rating` of them. Used on both
// the queue history card and inside the details modal.
function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? COLORS.warning : COLORS.gray}
          style={styles.starIcon}
        />
      ))}
    </View>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#E6F6EC', text: '#1E9E4F' },
  done: { bg: '#E6F6EC', text: '#1E9E4F' },
  pending: { bg: '#FFF4E0', text: '#C9860A' },
  waiting: { bg: '#FFF4E0', text: '#C9860A' },
  serving: { bg: '#E8F0FE', text: '#2A64D6' },
  cancelled: { bg: '#FBE8E8', text: '#D3453B' },
  canceled: { bg: '#FBE8E8', text: '#D3453B' },
  missed: { bg: '#FBE8E8', text: '#D3453B' },
};

const getStatusStyle = (status: string) => {
  const key = (status || '').toLowerCase();
  return STATUS_STYLES[key] ?? { bg: '#F0F0F0', text: COLORS.gray };
};

type TypeFilter = 'all' | 'walkin' | 'appointment';
type StatusFilter = 'all' | 'completed' | 'cancelled';

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'walkin', label: 'Walk-in' },
  { value: 'appointment', label: 'Appointment' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function FilterDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.dropdownWrapper}>
      <TouchableOpacity
        style={[styles.dropdownTrigger, open && styles.dropdownTriggerOpen]}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.dropdownTriggerText} numberOfLines={1}>
          {selected?.label}
        </Text>
        <Text style={styles.dropdownChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.dropdownMenu}>
            {options.map((option) => {
              const isActive = option.value === value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownOption,
                    isActive && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      isActive && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>

                  {isActive && (
                    <Text style={styles.dropdownCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function Queue() {

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const [showModal, setShowModal] =
    useState(false);

  const fetchTransactions = async () => {

    try {

      const user = await AsyncStorage.getItem('user');

      if (!user) {
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(user);

      const response = await fetch(
        `${API.getStudentTransactions}?student_id=${parsed.id}`
      );

      const data = await response.json();

      console.log(data);

      if (data.success) {
        setTransactions(data.transactions);
      } else {
        setTransactions([]);
      }

    } catch (error) {

      console.log(error);
      setTransactions([]);

    } finally {

      setLoading(false);
      setRefreshing(false);

    }

  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter(item => {

    const typeMatch =
      typeFilter === 'all'
        ? true
        : item.type === typeFilter;

    const status = item.status.toLowerCase();

    const statusMatch =
      statusFilter === 'all'
        ? true
        : statusFilter === 'completed'
          ? status === 'completed' || status === 'done'
          : status === 'cancelled' || status === 'canceled';

    return typeMatch && statusMatch;

  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getServiceItemList = (service_items: string) => {
    return (service_items || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const formatTime = (time: string) => {

    if (!time) return '-';

    const today = new Date().toISOString().split('T')[0];

    return new Date(`${today}T${time}`)
      .toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

  };

  if (loading) {
    return (
      <View style={styles.container}>
        <AppHeader />

        <View style={styles.loaderContainer}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >

        <View style={styles.filterRow}>
          <FilterDropdown
            value={typeFilter}
            options={TYPE_OPTIONS}
            onChange={setTypeFilter}
          />

          <FilterDropdown
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
          />
        </View>

        {filteredTransactions.length === 0 ? (

          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIconText}>#</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No Queue History
            </Text>

            <Text style={styles.emptySubtitle}>
              No matching queue history found.
            </Text>
          </View>

        ) : (

          filteredTransactions.map((item) => {
            const statusStyle = getStatusStyle(item.status);
            const isPriority = !!item.priority;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedTransaction(item);
                  setShowModal(true);
                }}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardLeft}>
                    <Text style={styles.queueNumber}>
                      {item.queue_number}
                    </Text>

                    <Text style={styles.office} numberOfLines={1}>
                      {item.office_name}
                    </Text>
                  </View>

                  <View style={styles.cardRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusStyle.bg },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: statusStyle.text },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: statusStyle.text },
                        ]}
                      >
                        {item.status?.toUpperCase()}
                      </Text>
                    </View>

                    {!!item.feedback_rating && (
                      <StarRow rating={item.feedback_rating} size={11} />
                    )}
                  </View>
                </View>

                <View style={styles.cardBottomRow}>
                  <View style={styles.chipRow}>
                    <View style={styles.typeChip}>
                      <Text style={styles.typeChipText}>
                        {item.type === 'walkin' ? 'Walk-in' : 'Appointment'}
                      </Text>
                    </View>

                    {isPriority && (
                      <View style={styles.priorityPill}>
                        <Text style={styles.priorityPillText}>PRIORITY</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.cardMeta}>
                    {formatDate(item.transaction_date)} · {formatTime(item.transaction_time)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })

        )}

        {/* MODAL */}

        <Modal
          visible={showModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>

            <View style={styles.modalCard}>

              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>
                Queue Details
              </Text>

              {selectedTransaction && (
                <>

                  <View style={styles.modalHeroRow}>
                    <Text style={styles.modalHeroQueueNumber}>
                      {selectedTransaction.queue_number}
                    </Text>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusStyle(
                            selectedTransaction.status
                          ).bg,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: getStatusStyle(
                              selectedTransaction.status
                            ).text,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          {
                            color: getStatusStyle(
                              selectedTransaction.status
                            ).text,
                          },
                        ]}
                      >
                        {selectedTransaction.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>
                        Office
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedTransaction.office_name}
                      </Text>
                    </View>

                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>
                        Window
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedTransaction.window_name ?? 'Not Assigned'}
                      </Text>
                    </View>

                    {!!selectedTransaction.feedback_rating && (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>
                          Your Rating
                        </Text>

                        <View style={styles.modalValueStarWrap}>
                          <StarRow rating={selectedTransaction.feedback_rating} size={16} />
                        </View>
                      </View>
                    )}

                    {getServiceItemList(selectedTransaction.service_items).length > 0 ? (
                      <View style={styles.modalSection}>
                        <Text style={styles.modalSectionLabel}>
                          Service Items Requested
                        </Text>

                        <View style={styles.serviceItemsList}>
                          {getServiceItemList(selectedTransaction.service_items).map(
                            (item, index) => (
                              <View key={index} style={styles.serviceItemRow}>
                                <View style={styles.serviceItemIndex}>
                                  <Text style={styles.serviceItemIndexText}>
                                    {index + 1}
                                  </Text>
                                </View>
                                <Text style={styles.serviceItemText}>{item}</Text>
                              </View>
                            )
                          )}
                        </View>
                      </View>
                    ) : selectedTransaction.event_name ? (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>
                          Event
                        </Text>

                        <Text style={styles.modalValue}>
                          {selectedTransaction.event_name}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>
                        Queue Type
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedTransaction.type === 'walkin'
                          ? 'Walk-in'
                          : 'Appointment'}
                      </Text>
                    </View>

                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>
                        Priority
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedTransaction.priority ? 'YES' : 'NO'}
                      </Text>
                    </View>

                    {selectedTransaction.priority == 1 &&
                    selectedTransaction.priority_reason ? (
                      <View style={styles.modalRow}>
                        <Text style={styles.modalLabel}>
                          Reason
                        </Text>

                        <Text style={styles.modalValue}>
                          {selectedTransaction.priority_reason}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>
                        Date
                      </Text>

                      <Text style={styles.modalValue}>
                        {formatDate(selectedTransaction.transaction_date)}
                      </Text>
                    </View>

                    <View style={[styles.modalRow, styles.modalRowLast]}>
                      <Text style={styles.modalLabel}>
                        Time
                      </Text>

                      <Text style={styles.modalValue}>
                        {formatTime(selectedTransaction.transaction_time)}
                      </Text>
                    </View>
                  </View>

                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.closeButtonText}>
                  Close
                </Text>
              </TouchableOpacity>

            </View>

          </View>
        </Modal>

      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 5,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 18,
  },

  // ----- Filters -----

  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  dropdownWrapper: {
    flex: 1,
  },

  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F3F3F3',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  dropdownTriggerOpen: {
    borderColor: COLORS.primary,
  },

  dropdownTriggerText: {
    color: COLORS.secondary,
    fontWeight: '600',
    fontSize: 13,
    flexShrink: 1,
  },

  dropdownChevron: {
    fontSize: 10,
    color: COLORS.gray,
    marginLeft: 8,
  },

  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  dropdownMenu: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 6,
    overflow: 'hidden',
  },

  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },

  dropdownOptionActive: {
    backgroundColor: '#fdf5f5',
  },

  dropdownOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  dropdownOptionTextActive: {
    color: COLORS.primary,
  },

  dropdownCheck: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ----- Empty state -----

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECECEC',
    marginTop: 30,
  },

  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  emptyIconText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.gray,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.secondary,
    marginBottom: 8,
  },

  emptySubtitle: {
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ----- Queue list cards -----

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ECECEC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },

  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cardLeft: {
    flex: 1,
    marginRight: 10,
  },

  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },

  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },

  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  starIcon: {
    marginRight: 2,
  },

  modalValueStarWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },

  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  queueNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 1,
  },

  office: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  typeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: '#F3F3F3',
  },

  typeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray,
  },

  priorityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: COLORS.primarySoft,
  },

  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },

  // ----- Modal -----

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '85%',
  },

  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
    alignSelf: 'center',
    marginBottom: 10,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 12,
  },

  modalHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },

  modalHeroQueueNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
  },

  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  modalRowLast: {
    borderBottomWidth: 0,
  },

  modalLabel: {
    width: '40%',
    color: COLORS.gray,
    fontWeight: '600',
    fontSize: 13,
  },

  modalValue: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 13,
  },

  // ----- Service items list (inside modal) -----

  modalSection: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  modalSectionLabel: {
    color: COLORS.gray,
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 8,
  },

  serviceItemsList: {
    gap: 6,
  },

  serviceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },

  serviceItemIndex: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  serviceItemIndexText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  serviceItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  closeButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },

  closeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});