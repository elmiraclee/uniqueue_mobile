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

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWindows();
    loadDocuments();
  }, []);
  
  const loadWindows = async () => {
    try {
      setLoading(true);

      const user = await AsyncStorage.getItem('user');
      if (!user) return;

      const parsedUser = JSON.parse(user);

      const response = await fetch(
         `http://192.168.1.26/uniqueue_api/get_windows.php?office_id=${parsedUser.office_id}`
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
          `http://192.168.1.26/uniqueue_api/get_documents.php?office_id=${parsedUser.office_id}`
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

    setName('');
    setStatus('open');
    setSpeed('normal');
    setQueueType('walkin');
    setSelectedDocuments([]);

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

    setEditingId(item.id);
    setName(item.name);
    setStatus(item.status);
    setSpeed(item.speed);
    setQueueType(item.queue_type || 'walkin');

    const ids = item.documents.map((doc: any) => doc.id);

    setSelectedDocuments(ids);
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
    };

    const url = isEdit
      ? 'http://192.168.1.26/uniqueue_api/update_windows.php'
      : 'http://192.168.1.26/uniqueue_api/add_windows.php';

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
    data.message || 'Window saved successfully.',
    [
      {
        text: 'OK',
        onPress: () => {
          setModalVisible(false);
          resetForm();
          loadWindows();
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
              'http://192.168.1.26/uniqueue_api/delete_windows.php',
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