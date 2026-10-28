import React, { useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  TextInputKeyPressEvent,
  View,
} from 'react-native';

import { COLORS } from '../../constants/theme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
}

/**
 * One box per digit, same as the web reset form.
 * Handles paste (a multi-digit string lands in one box and spreads out),
 * backspace stepping back, and auto-advance.
 */
export default function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  onComplete,
}: Props) {
  const inputs = useRef<(React.ComponentRef<typeof TextInput> | null)[]>([]);
  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const handleChange = (text: string, index: number) => {
    const typed = text.replace(/\D/g, '');

    // Pasted / autofilled code — spread it across the boxes.
    if (typed.length > 1) {
      const next = (value.slice(0, index) + typed).slice(0, length);
      commit(next);
      const focusAt = Math.min(next.length, length - 1);
      inputs.current[focusAt]?.focus();
      return;
    }

    const chars = value.padEnd(length, ' ').split('');
    chars[index] = typed || ' ';
    commit(chars.join('').replace(/ /g, ''));

    if (typed && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: TextInputKeyPressEvent,
    index: number
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (digits[index].trim()) {
      const chars = value.padEnd(length, ' ').split('');
      chars[index] = ' ';
      commit(chars.join('').replace(/ /g, ''));
      return;
    }
    if (index > 0) {
      const chars = value.padEnd(length, ' ').split('');
      chars[index - 1] = ' ';
      commit(chars.join('').replace(/ /g, ''));
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }).map((_, i) => {
        const char = digits[i]?.trim() ?? '';
        return (
          <TextInput
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            style={[styles.box, !!char && styles.boxFilled]}
            value={char}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={length}
            selectTextOnFocus
            autoFocus={autoFocus && i === 0}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            returnKeyType="done"
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 54,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    padding: 0,
  },
  boxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: '#fdf5f5',
  },
});
