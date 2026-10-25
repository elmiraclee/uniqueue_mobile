import { clientAlert } from '@/components/client/client-ui';
import { clientFetch } from '@/utils/client-fetch';
import PasswordChecklist from '@/components/ui/password-checklist';
import { passwordError } from '@/utils/password';
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useClientUI } from '@/components/client/client-ui';
import CustomInput from '@/components/ui/custom-input';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { API } from '@/constants/backend';
import { fetchJsonOrNull, safeFetchJson } from '@/utils/api';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface Props {
  visible: boolean;
  studentId: number;
  onClose: () => void;
}

export default function ChangePasswordModal({ visible, studentId, onClose }: Props) {
  const clientUI=useClientUI();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      clientAlert('Missing Fields', 'Please fill in all fields.');
      return;
    }

    if (passwordError(newPassword)) {
      clientAlert('Weak Password', passwordError(newPassword)||'Check password requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      clientAlert('Mismatch', 'New password and confirmation do not match.');
      return;
    }

    try {
      setSubmitting(true);

      const response = await clientFetch(API.changePassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        clientUI.notify(data.message||'Password updated.');
        handleClose();
      } else {
        clientAlert('Unable to Change Password', data.message);
      }
    } catch (error) {
      console.log('CHANGE PASSWORD ERROR:', error);
      clientAlert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.overlay}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:"90%"}} contentContainerStyle={styles.modal}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={COLORS.gray} />
          </TouchableOpacity>

          <Text style={styles.title}>Change Password</Text>

          <Text style={styles.label}>Current Password</Text>
          <CustomInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Enter current password"
            placeholderTextColor={COLORS.accent}
          />

          <Text style={styles.label}>New Password</Text>
          <CustomInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor={COLORS.accent}
          />

          <Text style={styles.label}>Confirm New Password</Text>
          <CustomInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Re-enter new password"
            placeholderTextColor={COLORS.accent}
          />

          <PasswordChecklist password={newPassword} confirm={confirmPassword}/>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={submit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>
              {submitting ? 'Updating…' : 'Update Password'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: COLORS.overlay,
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 10,
  },
  title: {
    ...TYPOGRAPHY.title,
    fontSize: 17,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOWS.glow,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
