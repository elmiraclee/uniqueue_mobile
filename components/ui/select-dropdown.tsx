import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../../constants/theme';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Compact dropdown (select) control.
 *
 * Used anywhere a list of configured options can be long — e.g. the
 * academic school years, which follow the office's configured range
 * (can be 1999-2000 up to 2027-2028) and would be unusable as pills.
 */
export default function SelectDropdown({
  value,
  options,
  placeholder = 'Select…',
  onChange,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        activeOpacity={0.85}
        disabled={disabled || options.length === 0}
        onPress={() => setOpen(true)}
      >
        <Text
          style={[styles.triggerText, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected?.label ??
            (options.length === 0 ? 'Not configured' : placeholder)}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.menu}>
            <ScrollView bounces={false}>
              {options.map((option) => {
                const isActive = option.value === value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, isActive && styles.optionActive]}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isActive && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isActive && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  triggerDisabled: {
    backgroundColor: '#f5f5f5',
  },
  triggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  placeholder: {
    color: COLORS.gray,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 12,
    color: COLORS.gray,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 14,
    maxHeight: '60%',
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  optionActive: {
    backgroundColor: '#fdf5f5',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
  },
  optionTextActive: {
    color: COLORS.primary,
  },
  check: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
