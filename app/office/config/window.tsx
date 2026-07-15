import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import AppHeader from '../../../components/layout/app-header';
import ConfigDrawer from '../../../components/layout/config-drawer';
import { API } from '../../../constants/backend';
import { COLORS } from '../../../constants/theme';

export default function Window() {

  const router = useRouter();

  const [windows, setWindows] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  const [drawerVisible, setDrawerVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [status, setStatus] = useState('open');
  const [speed, setSpeed] = useState('normal');

  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [queueType, setQueueType] = useState('walkin');

  const [staffRoster, setStaffRoster] = useState<any[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [staffDropdownOpen, setStaffDropdownOpen] = useState(false);

  const [saving, setSaving] = useState(false);

  // Refetch every time this screen comes into focus (not just on first
  // mount) — otherwise staff added from the Staff Configuration screen
  // won't show up here until the app is fully reloaded, since Expo
  // Router keeps this screen mounted in the background when navigating
  // away and back.
  useFocusEffect(
    useCallback(() => {
      loadWindows();
      loadDocuments();
      loadStaff();
    }, [])
  );

  const loadWindows = async () => {
    try {
      setLoading(true);

      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsedUser = JSON.parse(user);

      const response = await fetch(
         API.getWindows + `?office_id=${parsedUser.office_id}`
      );

      const data = await response.json();

      if (data.success) {
        setWindows(data.windows);
      }

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {

    try {

      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsedUser = JSON.parse(user);

      // FIXED: changed 192.168.1.17 -> 192.168.50.5 (consistent IP)
      const response = await fetch(
          API.getDocuments + `?office_id=${parsedUser.office_id}`
      );

      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents);
      }

    } catch (error) {
      console.log(error);
    }
  };

  const loadStaff = async () => {

    try {

      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsedUser = JSON.parse(user);

      const response = await fetch(
        API.getStaff + `?office_id=${parsedUser.office_id}`
      );

      const data = await response.json();

      if (data.success) {
        const normalized = (data.staff || []).map((member: any) => ({
          ...member,
          id: Number(member.id),
          window_id:
            member.window_id === null || member.window_id === undefined
              ? null
              : Number(member.window_id),
        }));

        setStaffRoster(normalized);
      }

    } catch (error) {
      console.log(error);
    }
  };

  const resetForm = () => {

    setName('');
    setStatus('open');
    setSpeed('normal');
    setQueueType('walkin');
    setSelectedDocuments([]);
    setSelectedStaffIds([]);
    setStaffDropdownOpen(false);

    setEditingId(null);
  };

  const openAddModal = () => {

    resetForm();

    setIsEdit(false);
    setModalVisible(true);
  };

  const openEditModal = (item: any) => {

    setIsEdit(true);
    setModalVisible(true);

    setEditingId(Number(item.id));
    setName(item.name);
    setStatus(item.status);
    setSpeed(item.speed);
    setQueueType(item.queue_type || 'walkin');

    const ids = item.documents.map((doc: any) => doc.id);

    setSelectedDocuments(ids);

    const assignedStaffIds = (item.staff || []).map((s: any) => Number(s.id));

    setSelectedStaffIds(assignedStaffIds);
    setStaffDropdownOpen(false);
  };

  // --- Staff helpers (dropdown-style selection from the office roster) ---

  // A roster member is unavailable if they're already assigned to a
  // *different* window (their own current window is always fine).
  const isStaffTaken = (member: any) => {
    return (
      member.window_id !== null &&
      member.window_id !== undefined &&
      member.window_id !== editingId
    );
  };

  const toggleStaff = (member: any) => {

    if (isStaffTaken(member)) {
      Alert.alert('Unavailable', 'This staff member is already assigned to another window.');
      return;
    }

    if (selectedStaffIds.includes(member.id)) {
      setSelectedStaffIds(selectedStaffIds.filter((id) => id !== member.id));
    } else {
      setSelectedStaffIds([...selectedStaffIds, member.id]);
    }
  };

  const removeAssignedStaff = (id: number) => {
    setSelectedStaffIds(selectedStaffIds.filter((staffId) => staffId !== id));
  };

  const toggleDocument = (id: number) => {

    if (selectedDocuments.includes(id)) {

      setSelectedDocuments(
        selectedDocuments.filter(docId => docId !== id)
      );

    } else {

      setSelectedDocuments([
        ...selectedDocuments,
        id
      ]);
    }
  };

  const saveWindow = async () => {

  if (saving) return;

  try {

    setSaving(true);

    const user = await AsyncStorage.getItem('user');
    if (!user) return;

    const parsedUser = JSON.parse(user);

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter window name');
      return;
    }

    const payload = {
      id: editingId,
      office_id: parsedUser.office_id,
      name,
      status,
      speed,
      queue_type: queueType,
      documents:
        queueType === 'walkin' || queueType === 'both'
          ? selectedDocuments
          : [],
      staff: selectedStaffIds.map((id) => ({ id })),
    };

    const url = isEdit
      ? API.updateWindow
      : API.addWindow;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

if (data.success) {

  // TEMP DIAGNOSTIC: shows staff_assigned/staff_skipped from the backend
  // (present on update_windows.php responses) so we can see whether the
  // staff UPDATE actually matched rows or silently skipped some ids.
  // Remove this block once the window_id bug is root-caused.
  const debugStaffInfo =
    data.staff_assigned !== undefined
      ? `\n\nDebug — assigned: ${data.staff_assigned}, skipped: ${JSON.stringify(data.staff_skipped)}`
      : '';

  Alert.alert(
    'Success',
    (data.message || 'Window saved successfully.') + debugStaffInfo,
    [
      {
        text: 'OK',
        onPress: () => {
          setModalVisible(false);
          resetForm();
          loadWindows();
          loadStaff();
        }
      }
    ],
    {
      cancelable: false
    }
  );

} else {

  Alert.alert(
    'Error',
    data.message || 'Unable to save window'
  );

}
  } catch (error) {
    console.log(error);
    Alert.alert('Error', 'Something went wrong');
  } finally {
    setSaving(false);
  }
};

  const deleteWindow = async (id: number) => {

    Alert.alert(
      'Delete',
      'Delete this window?',
      [
        { text: 'Cancel' },

        {
          text: 'Delete',

          onPress: async () => {

            const response = await fetch(
              API.deleteWindow,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id }),
              }
            );

            const data = await response.json();

            if (data.success) {
              loadWindows();
            }
          }
        }
      ]
    );
  };

  return (

    <View style={styles.container}>

      <AppHeader title="Window Configuration" />

      <View style={styles.menuContainer}>
        <Pressable onPress={() => setDrawerVisible(true)}>
          <Ionicons
            name="menu"
            size={32}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      {loading && (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      )}

      <FlatList
        style={{ flex: 1 }}
        data={windows}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (

          <View style={styles.card}>

            <Text style={styles.title}>
              {item.name}
            </Text>

            <Text>
              Status: {item.status}
            </Text>

            <Text>
              Speed: {item.speed}
            </Text>

            <Text>
              Queue Type:
              {item.queue_type === 'walkin'
                ? ' Walk-in'
                : item.queue_type === 'appointment'
                ? ' Appointment'
                : ' Walk-in & Appointment'}
            </Text>

          <Text style={styles.docTitle}>
            Documents Handled:
          </Text>

          {item.queue_type === 'walkin' || item.queue_type === 'both' ? (
            item.documents?.length > 0 ? (
              item.documents.map((doc: any) => (
                <Text key={doc.id}>
                  • {doc.name}
                </Text>
              ))
            ) : (
              <Text style={{ color: '#999' }}>
                No documents assigned
              </Text>
            )
          ) : (
            <Text style={{ color: '#999' }}>
              Not applicable for Appointment
            </Text>
          )}

          <Text style={styles.docTitle}>
            Staff:
          </Text>

          {item.staff?.length > 0 ? (
            item.staff.map((s: any) => (
              <Text key={s.id}>
                • {s.name}
                {s.status === 'inactive' ? ' — inactive' : ''}
              </Text>
            ))
          ) : (
            <Text style={{ color: '#999' }}>
              No staff assigned
            </Text>
          )}

            <View style={styles.actionsRow}>
                          <Pressable
                            style={styles.editBtn}
                            onPress={() => openEditModal(item)}
                          >
                            <Ionicons name="create-outline" size={18} color="#fff" />
                            <Text style={styles.btnText}>Edit</Text>
                          </Pressable>
            
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={() => deleteWindow(item.id)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#fff" />
                            <Text style={styles.btnText}>Delete</Text>
                          </Pressable>
                        </View>

          </View>

        )}
      />

      <Pressable
        style={styles.fab}
        onPress={openAddModal}
      >
        <Ionicons
          name="add"
          size={28}
          color="#fff"
        />
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
      >

        <ScrollView contentContainerStyle={styles.modalContainer}>

          <View style={styles.modalContent}>

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEdit ? 'Edit Window' : 'Add Window'}
              </Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={20} color="#666" />
              </Pressable>
            </View>

            {/* Window Name */}
            <Text style={styles.label}>Window Name</Text>
            <TextInput
              placeholder="e.g. Window 1"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor="#aaa"
            />

            {/* Status */}
            <Text style={styles.label}>Status</Text>
            <View style={styles.pillRow}>
              {['open', 'closed'].map(s => (
                <Pressable
                  key={s}
                  style={[
                    styles.pill,
                    status === s && styles.pillActive,
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[
                    styles.pillText,
                    status === s && styles.pillTextActive,
                  ]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Speed */}
            <Text style={styles.label}>Speed</Text>
            <View style={styles.pillRow}>
              {['slow', 'normal', 'fast'].map(s => (
                <Pressable
                  key={s}
                  style={[
                    styles.pill,
                    speed === s && styles.pillActive,
                  ]}
                  onPress={() => setSpeed(s)}
                >
                  <Text style={[
                    styles.pillText,
                    speed === s && styles.pillTextActive,
                  ]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Queue Type */}
            <Text style={styles.label}>Queue Type</Text>
            <View style={styles.pillRow}>
              {['walkin', 'appointment', 'both'].map(type => (
                <Pressable
                  key={type}
                  style={[
                    styles.pill,
                    queueType === type && styles.pillActive,
                  ]}
                  onPress={() => setQueueType(type)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      queueType === type && styles.pillTextActive,
                    ]}
                  >
                    {type === 'walkin'
                    ? 'Walk-in'
                    : type === 'appointment'
                    ? 'Appointment'
                    : 'Both'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Documents */}
           {(queueType === 'walkin' || queueType === 'both') && (
            <>
              <Text style={styles.label}>Documents</Text>

              <View style={styles.docList}>
                {documents.map((doc) => {
                  const selected = selectedDocuments.includes(doc.id);

                  return (
                    <Pressable
                      key={doc.id}
                      style={[
                        styles.docRow,
                        selected && styles.docRowActive,
                      ]}
                      onPress={() => toggleDocument(doc.id)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selected && styles.checkboxActive,
                        ]}
                      >
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={13}
                            color="#fff"
                          />
                        )}
                      </View>

                      <Text
                        style={[
                          styles.docRowText,
                          selected && styles.docRowTextActive,
                        ]}
                      >
                        {doc.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

            {/* Staff */}
            <Text style={styles.label}>Assign Staff</Text>
            <Text style={styles.hint}>
              Currently assigned staff are listed below — tap the × to
              remove one. Use the dropdown to add staff from your roster.
            </Text>

            {selectedStaffIds.length > 0 ? (
              <View style={styles.assignedStaffWrap}>
                {staffRoster
                  .filter((member) => selectedStaffIds.includes(member.id))
                  .map((member) => (
                    <View key={member.id} style={styles.assignedStaffChip}>
                      <Text style={styles.assignedStaffChipText}>
                        {member.name}
                        {member.status === 'inactive' ? ' (inactive)' : ''}
                      </Text>
                      <Pressable onPress={() => removeAssignedStaff(member.id)}>
                        <Ionicons
                          name="close-circle"
                          size={16}
                          color={COLORS.primary}
                        />
                      </Pressable>
                    </View>
                  ))}
              </View>
            ) : (
              <Text style={styles.hint}>No staff currently assigned.</Text>
            )}

            <Pressable
              style={[
                styles.dropdownTrigger,
                staffDropdownOpen && styles.dropdownTriggerOpen,
              ]}
              onPress={() => setStaffDropdownOpen(!staffDropdownOpen)}
            >
              <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                Add Staff
              </Text>

              <Ionicons
                name={staffDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#666"
              />
            </Pressable>

            {staffDropdownOpen && (
              <View style={[styles.docList, styles.staffDropdownList]}>
                {staffRoster.length === 0 && (
                  <Text style={{ padding: 12, color: '#999' }}>
                    No staff in your roster yet.
                  </Text>
                )}

                {staffRoster.length > 0 && (
                  <Text style={styles.dropdownListHint}>
                    Greyed out names are already assigned to another window.
                  </Text>
                )}

                {staffRoster.map((member) => {
                  const selected = selectedStaffIds.includes(member.id);
                  const taken = isStaffTaken(member);

                  return (
                    <Pressable
                      key={member.id}
                      style={[
                        styles.docRow,
                        selected && styles.docRowActive,
                        taken && styles.docRowDisabled,
                      ]}
                      onPress={() => toggleStaff(member)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selected && styles.checkboxActive,
                        ]}
                      >
                        {selected && (
                          <Ionicons
                            name="checkmark"
                            size={13}
                            color="#fff"
                          />
                        )}
                      </View>

                      <Text
                        style={[
                          styles.docRowText,
                          selected && styles.docRowTextActive,
                        ]}
                      >
                        {member.name}
                        {member.status === 'inactive' ? ' (inactive)' : ''}
                        {taken ? ' — assigned elsewhere' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

        <Pressable
          style={[
            styles.saveBtn,
            saving && { opacity: 0.6 }
          ]}
          disabled={saving}
          onPress={saveWindow}
        >
          <Text style={styles.saveBtnText}>
            {saving
              ? 'Saving...'
              : isEdit
              ? 'Save Changes'
              : 'Add Window'}
          </Text>
        </Pressable>
            </View>

          </View>

        </ScrollView>

      </Modal>

      <ConfigDrawer
        visible={drawerVisible}
        activeScreen="window"
        onClose={() => setDrawerVisible(false)}
        onDocumentPress={() => {
          setDrawerVisible(false);
          router.push('/office/config/document');
        }}
        onWindowPress={() => setDrawerVisible(false)}
        onStaffPress={() => {
          setDrawerVisible(false);
          router.push('/office/config/staff');
        }}
        onCapacityPress={() => {
          setDrawerVisible(false);
          router.push('/office/config/capacity');
        }}
        onLogoutPress={async () => {
          await AsyncStorage.removeItem('user');
          await AsyncStorage.removeItem('role');

          router.replace('/login');
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  menuContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

   card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 15,
    borderRadius: 10,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },

  docTitle: {
    marginTop: 10,
    fontWeight: '700',
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
    gap: 10,
  },

  editBtn: {
    flexDirection: 'row',
    backgroundColor: '#7A7A7A',
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    gap: 5,
  },

  deleteBtn: {
    flexDirection: 'row',
    backgroundColor: '#660810',
    padding: 6,
    borderRadius: 6,
    alignItems: 'center',
    gap: 5,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
  },

  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 55,
    height: 55,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },

  modalContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },

  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },

  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 11,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fafafa',
  },

  label: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 13,
    color: '#444',
  },

  // Pill toggles
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },

  pill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
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

  // Document list
  docList: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 2,
  },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fafafa',
  },

  docRowActive: {
    backgroundColor: 'rgba(102, 8, 16, 0.05)',
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  docRowText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },

  docRowTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  docRowDisabled: {
    opacity: 0.45,
  },

  hint: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
    marginTop: -4,
  },

  // Staff dropdown
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
  },

  dropdownTriggerOpen: {
    borderColor: COLORS.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },

  dropdownTriggerText: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    marginRight: 8,
  },

  staffDropdownList: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    borderColor: COLORS.primary,
  },

  dropdownListHint: {
    fontSize: 11,
    color: '#999',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
    backgroundColor: '#fafafa',
  },

  // Currently assigned staff chips
  assignedStaffWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },

  assignedStaffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(102, 8, 16, 0.05)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },

  assignedStaffChipText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Modal action buttons
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },

  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },

  cancelBtnText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },

  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },

  saveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

});