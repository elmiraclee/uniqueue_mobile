import { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';

import AppHeader from '../../../components/layout/app-header';
import ConfigDrawer from '../../../components/layout/config-drawer';
import { API } from "../../../constants/backend";
import { COLORS } from '../../../constants/theme';


export default function Staff() {

  const router = useRouter();

  const [staffList, setStaffList] = useState<any[]>([]);

  const [drawerVisible, setDrawerVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [status, setStatus] = useState('active');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {

    try {
      setLoading(true);

      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsedUser = JSON.parse(user);

      const response = await fetch(
        API.getStaff + `?office_id=${parsedUser.office_id}`
      );

      const data = await response.json();

      if (data.success) {
        setStaffList(data.staff);
      }

    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {

    setName('');
    setPosition('');
    setStatus('active');

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
    setPosition(item.position || '');
    setStatus(item.status || 'active');
  };

  const saveStaff = async () => {

    if (saving) return;

    try {

      setSaving(true);

      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsedUser = JSON.parse(user);

      if (!name.trim()) {
        Alert.alert('Error', 'Please enter staff name');
        return;
      }

      const payload = {
        id: editingId,
        office_id: parsedUser.office_id,
        name: name.trim(),
        position: position.trim(),
        status,
      };

      const url = isEdit
        ? API.updateStaff
        : API.addStaff;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {

        Alert.alert(
          'Success',
          data.message || 'Staff member saved successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                setModalVisible(false);
                resetForm();
                loadStaff();
              }
            }
          ],
          {
            cancelable: false
          }
        );

      } else {

        // TEMP DIAGNOSTIC: data.received (if present) shows exactly what
        // the server got, so we can see whether 'id' is missing, null, or
        // something unexpected. Remove this once the id bug is root-caused.
        Alert.alert(
          'Error',
          (data.message || 'Unable to save staff member') +
            (data.received ? `\n\nDebug — received: ${JSON.stringify(data.received)}` : '')
        );

      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const deleteStaff = async (id: number) => {

    Alert.alert(
      'Delete',
      'Delete this staff member?',
      [
        { text: 'Cancel' },

        {
          text: 'Delete',

          onPress: async () => {

            const response = await fetch(
              API.deleteStaff,
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
              loadStaff();
            } else {
              Alert.alert('Error', data.message || 'Unable to delete staff member');
            }
          }
        }
      ]
    );
  };

  return (

    <View style={styles.container}>

      <AppHeader title="Staff Configuration" />

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
        data={staffList}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          !loading ? (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 30 }}>
              No staff members yet. Tap + to add one.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (

          <View style={styles.card}>

            <Text style={styles.title}>
              {item.name}
            </Text>

            <Text>
              Position: {item.position || '—'}
            </Text>

            <Text>
              Status: {item.status === 'inactive' ? 'Inactive' : 'Active'}
            </Text>

            <Text>
              Window: {item.window_name || 'Unassigned'}
            </Text>

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
                onPress={() => deleteStaff(item.id)}
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
                {isEdit ? 'Edit Staff' : 'Add Staff'}
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

            {/* Name */}
            <Text style={styles.label}>Staff Name</Text>
            <TextInput
              placeholder="e.g. Juan Dela Cruz"
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholderTextColor="#aaa"
            />

            {/* Position */}
            <Text style={styles.label}>Position</Text>
            <TextInput
              placeholder="e.g. Clerk, Cashier"
              value={position}
              onChangeText={setPosition}
              style={styles.input}
              placeholderTextColor="#aaa"
            />

            {/* Status */}
            <Text style={styles.label}>Status</Text>
            <View style={styles.pillRow}>
              {['active', 'inactive'].map((s) => (
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

            {isEdit && (
              <Text style={styles.hint}>
                Window assignment is managed from Window Configuration, not here.
              </Text>
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
                onPress={saveStaff}
              >
                <Text style={styles.saveBtnText}>
                  {saving
                    ? 'Saving...'
                    : isEdit
                    ? 'Save Changes'
                    : 'Add Staff'}
                </Text>
              </Pressable>
            </View>

          </View>

        </ScrollView>

      </Modal>

      <ConfigDrawer
        visible={drawerVisible}
        activeScreen="staff"
        onClose={() => setDrawerVisible(false)}
        onDocumentPress={() => {
          setDrawerVisible(false);
          router.push('/office/config/document');
        }}
        onWindowPress={() => {
          setDrawerVisible(false);
          router.push('/office/config/window');
        }}
        onStaffPress={() => setDrawerVisible(false)}
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

  hint: {
    fontSize: 12,
    color: '#888',
    marginTop: 10,
  },

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