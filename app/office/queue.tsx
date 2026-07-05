import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import AppHeader from '../../components/layout/app-header';
import { COLORS } from '../../constants/theme';

type QueueEntry = {
  id: number;
  name: string;
  queue_type: 'walkin' | 'appointment';
  status: 'waiting' | 'called' | 'in_progress' | 'done' | 'cancelled';
  window_id: number | null;
  window_name: string | null;
  created_at: string;
};

type WindowOption = {
  id: number;
  name: string;
};

export default function Queue() {

  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [windows, setWindows] = useState<WindowOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [windowFilter, setWindowFilter] = useState<'all' | number>('all');
  const [queueTypeFilter, setQueueTypeFilter] = useState<'all' | 'walkin' | 'appointment'>('all');

  const [windowDropdownOpen, setWindowDropdownOpen] = useState(false);

  useEffect(() => {
    loadWindows();
  }, []);

  useEffect(() => {
    loadQueue();
  }, [windowFilter, queueTypeFilter]);

  const getOfficeId = async () => {
    const user = await AsyncStorage.getItem('user');
    if (!user) return null;

    const parsedUser = JSON.parse(user);
    return parsedUser.office_id;
  };

  const loadWindows = async () => {
    try {
      const office_id = await getOfficeId();
      if (!office_id) return;

      const response = await fetch(
        `http://192.168.1.26/uniqueue_api/get_windows.php?office_id=${office_id}`
      );

      const data = await response.json();

      if (data.success) {
        setWindows(data.windows);
      }

    } catch (error) {
      console.log(error);
    }
  };

  const loadQueue = async () => {
    try {
      setLoading(true);

      const office_id = await getOfficeId();
      if (!office_id) return;

      const params = new URLSearchParams({ office_id: String(office_id) });

      if (windowFilter !== 'all') {
        params.append('window_id', String(windowFilter));
      }

      if (queueTypeFilter !== 'all') {
        params.append('queue_type', queueTypeFilter);
      }

      const response = await fetch(
        `http://192.168.1.26/uniqueue_api/get_queue.php?${params.toString()}`
      );

      const data = await response.json();

      if (data.success) {
        setQueue(data.queue);
      }

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadQueue();
  };

  const queueTypeLabel = (type: string) => {
    if (type === 'walkin') return 'Walk-in';
    if (type === 'appointment') return 'Appointment';
    return type;
  };

  const statusLabel = (status: string) => {
    if (status === 'in_progress') return 'In Progress';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return '#B8860B';
      case 'called':
        return '#1E6FBF';
      case 'in_progress':
        return '#1E7E34';
      default:
        return '#7A7A7A';
    }
  };

  const windowOptions = [{ id: 'all' as const, name: 'All Windows' }, ...windows];

  const selectedWindowLabel =
    windowFilter === 'all'
      ? 'All Windows'
      : windows.find((w) => w.id === windowFilter)?.name ?? 'All Windows';

  return (

    <View style={styles.container}>

      <AppHeader title="Queue" />

      {/* Window filter (dropdown) */}
      <Text style={styles.filterLabel}>Window</Text>

      <TouchableOpacity
        style={styles.dropdownButton}
        activeOpacity={0.7}
        onPress={() => setWindowDropdownOpen(true)}
      >
        <Text style={styles.dropdownButtonText}>{selectedWindowLabel}</Text>
        <Text style={styles.dropdownChevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={windowDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWindowDropdownOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setWindowDropdownOpen(false)}
        >
          <View style={styles.dropdownList}>
            <FlatList
              data={windowOptions}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isActive =
                  windowFilter === item.id || (windowFilter === 'all' && item.id === 'all');

                return (
                  <TouchableOpacity
                    style={[styles.dropdownItem, isActive && styles.dropdownItemActive]}
                    onPress={() => {
                      setWindowFilter(item.id === 'all' ? 'all' : (item.id as number));
                      setWindowDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isActive && styles.dropdownItemTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Queue type filter */}
      <Text style={styles.filterLabel}>Queue Type</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{ paddingHorizontal: 15, gap: 8 }}
        data={[
          { id: 'all', name: 'All' },
          { id: 'walkin', name: 'Walk-in' },
          { id: 'appointment', name: 'Appointment' },
        ]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isActive = queueTypeFilter === item.id;

          return (
            <View
              style={[styles.pill, isActive && styles.pillActive]}
              onTouchEnd={() => setQueueTypeFilter(item.id as 'all' | 'walkin' | 'appointment')}
            >
              <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                {item.name}
              </Text>
            </View>
          );
        }}
      />

      {loading && !refreshing && (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{ marginTop: 20 }}
        />
      )}

      <FlatList
        style={{ flex: 1, marginTop: 10 }}
        data={queue}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>No one in the queue.</Text>
          ) : null
        }
        renderItem={({ item }) => (

          <View style={styles.card}>

            <View style={styles.cardHeader}>
              <Text style={styles.name}>{item.name}</Text>

              <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.statusBadgeText}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.detailText}>
              Window: {item.window_name || 'Unassigned'}
            </Text>

            <Text style={styles.detailText}>
              Queue Type: {queueTypeLabel(item.queue_type)}
            </Text>

          </View>

        )}
      />

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  filterLabel: {
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 15,
    fontWeight: '700',
    fontSize: 13,
    color: '#444',
  },

  filterRow: {
    flexGrow: 0,
  },

  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },

  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  dropdownChevron: {
    fontSize: 14,
    color: '#666',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: 320,
    paddingVertical: 6,
    overflow: 'hidden',
  },

  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 18,
  },

  dropdownItemActive: {
    backgroundColor: '#f0f0f0',
  },

  dropdownItemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },

  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },

  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },

  pillTextActive: {
    color: '#fff',
  },

  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  name: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.primary,
  },

  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },

  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  detailText: {
    fontSize: 14,
    color: '#444',
    marginTop: 2,
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 14,
  },

});