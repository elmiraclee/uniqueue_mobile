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

import AsyncStorage from '@react-native-async-storage/async-storage';

import { API } from '@/constants/backend';
import AppHeader from '../../components/layout/app-header';
import { COLORS } from '../../constants/theme';

interface Transaction {
  id: number;
  queue_number: string;

  office_name: string;
  window_name: string | null;

  documents: string;

  status: string;
  type: string;

  priority: number;
  priority_reason: string;

  created_at: string;
  transaction_date: string;
  transaction_time: string;
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

export default function Queue() {

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<
    'all' | 'walkin' | 'appointment'
  >('all');

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

  const filteredTransactions =
    filter === 'all'
      ? transactions
      : transactions.filter(
          item => item.type === filter
        );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  const counts = {
    all: transactions.length,
    walkin: transactions.filter(t => t.type === 'walkin').length,
    appointment: transactions.filter(t => t.type === 'appointment').length,
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

        <View style={styles.filterContainer}>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'all' && styles.filterActive,
            ]}
            onPress={() => setFilter('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'all' && styles.filterTextActive,
              ]}
            >
              All
            </Text>
            <View
              style={[
                styles.filterBadge,
                filter === 'all' && styles.filterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  filter === 'all' && styles.filterBadgeTextActive,
                ]}
              >
                {counts.all}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'walkin' && styles.filterActive,
            ]}
            onPress={() => setFilter('walkin')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'walkin' && styles.filterTextActive,
              ]}
            >
              Walk-in
            </Text>
            <View
              style={[
                styles.filterBadge,
                filter === 'walkin' && styles.filterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  filter === 'walkin' && styles.filterBadgeTextActive,
                ]}
              >
                {counts.walkin}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'appointment' && styles.filterActive,
            ]}
            onPress={() => setFilter('appointment')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.filterText,
                filter === 'appointment' && styles.filterTextActive,
              ]}
            >
              Appointment
            </Text>
            <View
              style={[
                styles.filterBadge,
                filter === 'appointment' && styles.filterBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.filterBadgeText,
                  filter === 'appointment' && styles.filterBadgeTextActive,
                ]}
              >
                {counts.appointment}
              </Text>
            </View>
          </TouchableOpacity>

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
              No completed transactions found{filter !== 'all' ? ` for ${filter === 'walkin' ? 'walk-in' : 'appointment'} queues` : ''}.
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
                        <Text style={styles.priorityPillText}>Priority</Text>
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

                  <ScrollView
                    style={styles.modalScroll}
                    showsVerticalScrollIndicator={false}
                  >
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

                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>
                        Documents
                      </Text>

                      <Text style={styles.modalValue}>
                        {selectedTransaction.documents}
                      </Text>
                    </View>

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
                  </ScrollView>

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

  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 10,
  },

  filterButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 6,
  },

  filterActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  filterText: {
    color: COLORS.gray,
    fontWeight: '600',
    fontSize: 13,
  },

  filterTextActive: {
    color: '#fff',
  },

  filterBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  filterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gray,
  },

  filterBadgeTextActive: {
    color: '#fff',
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
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
    marginTop: 8,
  },

  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
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
    marginBottom: 2,
  },

  office: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },

  typeChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: '#FBE8E8',
  },

  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D3453B',
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
    padding: 22,
    maxHeight: '85%',
  },

  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5E5',
    alignSelf: 'center',
    marginBottom: 14,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 18,
  },

  modalHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },

  modalHeroQueueNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.primary,
  },

  modalScroll: {
    maxHeight: 340,
  },

  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
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
    fontSize: 14,
  },

  modalValue: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 14,
  },

  closeButton: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },

  closeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});