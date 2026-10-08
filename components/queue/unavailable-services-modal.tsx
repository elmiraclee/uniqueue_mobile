/**
 * "Request an unavailable service" sheet — mobile version of the web
 * unavailable-services popup (student-queue.php / dashboards):
 * multi-select per office, required choice per service when it has
 * options, an optional note, one request per service per day.
 * Works for students and for parents requesting on behalf of a child.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API } from '@/constants/backend';
import { fetchJsonOrNull } from '@/utils/api';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

type Choice = { id: number; label: string };
type Service = {
  id: number;
  office_id: number;
  name: string;
  category?: string | null;
  office_name: string;
  choices: Choice[];
  requested_today: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  studentId: number;
  parentId?: number;
  officeId?: number;
  childName?: string;
}

export default function UnavailableServicesModal({ visible, onClose, studentId, parentId, officeId, childName }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchJsonOrNull(API.getUnavailableServices, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, office_id: officeId || undefined }),
      });
      setServices(res?.success ? res.services || [] : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setSelected([]); setChoices({}); setNote('');
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, studentId, officeId]);

  const byOffice = useMemo(() => {
    const map: Record<string, { officeId: number; officeName: string; items: Service[] }> = {};
    services.forEach((s) => {
      const k = String(s.office_id);
      if (!map[k]) map[k] = { officeId: s.office_id, officeName: s.office_name, items: [] };
      map[k].items.push(s);
    });
    return Object.values(map);
  }, [services]);

  const selectedOffice = selected.length ? services.find((s) => s.id === selected[0])?.office_id : undefined;

  const toggle = (s: Service) => {
    if (s.requested_today) return;
    if (selectedOffice && selectedOffice !== s.office_id) {
      Alert.alert('One office at a time', 'Submit requests for one office first, then pick services from another office.');
      return;
    }
    setSelected((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]));
  };

  const submit = async () => {
    if (!selected.length || !selectedOffice) return;
    for (const sid of selected) {
      const svc = services.find((s) => s.id === sid);
      if (svc && svc.choices.length > 0 && !choices[sid]) {
        Alert.alert('Choose an option', `Please choose an option for "${svc.name}".`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const body: any = {
        office_id: selectedOffice,
        service_item_ids: selected,
        choice_ids: Object.fromEntries(selected.filter((id) => choices[id]).map((id) => [id, choices[id]])),
        note,
      };
      if (parentId) { body.parent_id = parentId; body.child_id = studentId; } else body.student_id = studentId;
      const res = await fetchJsonOrNull(API.serviceNeedRequestMulti, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res?.success) {
        Alert.alert('Request sent', res.message || 'The office has been notified.');
        setSelected([]); setChoices({}); setNote('');
        load();
      } else {
        Alert.alert('Not sent', res?.message || 'Could not record your request.');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>Unavailable services</Text>
          <Text style={styles.sub}>
            Let the office know {childName ? `${childName} needs` : 'you need'} a service that is currently unavailable.
            You can request each service once per day.
          </Text>
          {loading ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
          ) : services.length === 0 ? (
            <Text style={styles.empty}>All services are currently available.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 380 }}>
              {byOffice.map((g) => (
                <View key={g.officeId} style={{ marginBottom: 10 }}>
                  <Text style={styles.office}>{g.officeName}</Text>
                  {g.items.map((s) => {
                    const on = selected.includes(s.id);
                    return (
                      <View key={s.id}>
                        <Pressable
                          onPress={() => toggle(s)}
                          style={[styles.item, on && styles.itemOn, !!s.requested_today && { opacity: 0.5 }]}
                        >
                          <View style={[styles.box, on && styles.boxOn]}>{on && <Text style={styles.tick}>✓</Text>}</View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{s.name}</Text>
                            {!!s.requested_today && <Text style={styles.meta}>Already requested today</Text>}
                          </View>
                        </Pressable>
                        {on && s.choices.length > 0 && (
                          <View style={styles.choiceRow}>
                            {s.choices.map((c) => (
                              <Pressable
                                key={c.id}
                                onPress={() => setChoices((p) => ({ ...p, [s.id]: c.id }))}
                                style={[styles.chip, choices[s.id] === c.id && styles.chipOn]}
                              >
                                <Text style={[styles.chipText, choices[s.id] === c.id && { color: '#fff' }]}>{c.label}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          )}
          {selected.length > 0 && (
            <TextInput
              style={styles.note}
              placeholder="Note for the office (optional)"
              value={note}
              onChangeText={setNote}
              maxLength={500}
              multiline
            />
          )}
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancel}>
              <Text style={{ color: COLORS.gray, fontWeight: '700' }}>Close</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!selected.length || submitting}
              style={[styles.send, (!selected.length || submitting) && { opacity: 0.5 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                {submitting ? 'Sending…' : `Request${selected.length ? ` (${selected.length})` : ''}`}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.lg, paddingBottom: 32 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  sub: { color: COLORS.gray, marginTop: 4, marginBottom: 12, fontSize: 13 },
  empty: { color: COLORS.gray, textAlign: 'center', marginVertical: 24 },
  office: { fontWeight: '800', color: COLORS.primary, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 6 },
  itemOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '0D' },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: COLORS.primary },
  tick: { color: '#fff', fontWeight: '800', fontSize: 12 },
  name: { fontWeight: '600', color: COLORS.text },
  meta: { fontSize: 11, color: COLORS.gray },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginLeft: 30, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  note: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: RADIUS.md, padding: 10, minHeight: 60, marginTop: 8, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancel: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#e5e7eb' },
  send: { flex: 2, paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primary },
});
