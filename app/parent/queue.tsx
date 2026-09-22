import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../components/layout/app-header';
import AnimatedPressable from '../../components/ui/animated-pressable';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

/**
 * Parent office picker → joins queue on behalf of a linked child.
 * Passes forStudentId + asParent + parentId into office-queue wizard.
 */
export default function ParentQueueForChild() {
  const { forStudentId, childName } = useLocalSearchParams<{
    forStudentId?: string;
    childName?: string;
  }>();
  const [offices, setOffices] = useState<any[]>([]);
  const [parentId, setParentId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('user');
      if (raw) setParentId(JSON.parse(raw).id);
      const data = await fetchJsonOrNull(API.getOffice);
      if (data?.success) setOffices(data.offices || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openOffice = async (office: any) => {
    if (!forStudentId) return;
    try {
      // Family-wide: any linked child with active ticket blocks new join
      const raw = await AsyncStorage.getItem('user');
      const parent = raw ? JSON.parse(raw) : null;
      if (parent?.id) {
        const kids = await fetchJsonOrNull(API.getParentChildren, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_id: parent.id }),
        });
        const list = kids?.children || [];
        const busy = list.find((c: any) => Number(c.active_ticket_id) > 0);
        if (busy) {
          Alert.alert(
            'Queue in progress',
            `${busy.first_name} ${busy.last_name} already has ticket #${busy.active_queue_number || busy.active_ticket_id} at ${busy.active_office || 'an office'}. Finish or cancel that first — only one active queue per parent (you cannot be called at two places at once).`
          );
          return;
        }
      }
    } catch {}
    router.push({
      pathname: '/parent/office-queue',
      params: {
        office: office.slug,
        forStudentId: String(forStudentId),
        asParent: '1',
        parentId: String(parentId),
      },
    } as any);
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Join queue for child" showBack />
      <Text style={styles.banner}>
        Queuing for {childName || 'child'} · offices below
      </Text>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
          }
        >
          {offices.map((o) => (
            <AnimatedPressable key={o.id} style={styles.card} onPress={() => openOffice(o)}>
              <View style={styles.icon}>
                <Ionicons name="business-outline" size={22} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{o.name}</Text>
                {o.description ? (
                  <Text style={styles.desc} numberOfLines={2}>{o.description}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </AnimatedPressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  banner: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    color: COLORS.gray,
    fontSize: 13,
  },
  scroll: { padding: SPACING.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 10,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontWeight: '700', color: COLORS.text },
  desc: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
});
