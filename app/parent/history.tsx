import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

import AppHeader from '../../components/layout/app-header';
import StatusBadge from '../../components/ui/status-badge';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function ParentHistory() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q = search) => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (!raw) return;
      const user = JSON.parse(raw);
      const res = await fetchJsonOrNull(API.getParentTransactions, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: user.id, search: q }),
      });
      if (res?.success) setItems(res.transactions || []);
    } finally {
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <AppHeader title="Queue history" />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          placeholder="Search queue #, office, child…"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load(search)}
          returnKeyType="search"
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {items.map((t) => (
          <View key={t.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.qn}>#{t.queue_number}</Text>
              <StatusBadge status={t.status} />
            </View>
            <Text style={styles.office}>{t.office_name}</Text>
            <Text style={styles.child}>
              {t.first_name} {t.last_name} ({t.sr_code})
            </Text>
            <Text style={styles.meta}>
              {t.type}
              {t.created_by_role === 'parent' ? ' · queued by you' : ''}
              {' · '}
              {t.created_at ? new Date(t.created_at).toLocaleString() : ''}
            </Text>
          </View>
        ))}
        {items.length === 0 && (
          <Text style={{ textAlign: 'center', color: COLORS.gray, marginTop: 24 }}>
            No transactions found
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  searchWrap: { paddingHorizontal: SPACING.lg, paddingTop: 8 },
  search: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scroll: { padding: SPACING.lg },
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qn: { fontWeight: '800', fontSize: 18, color: COLORS.primary },
  office: { fontWeight: '600', marginTop: 4, color: COLORS.text },
  child: { color: COLORS.gray, marginTop: 2 },
  meta: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
});
