// components/ui/CustomButton.tsx

import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

import { COLORS } from '../../constants/theme';

export default function CustomButton({
  title,
  onPress,
  outlined = false,
}: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.button,
        outlined && styles.outlined,
      ]}>
      <Text
        style={[
          styles.text,
          outlined && styles.outlinedText,
        ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },

  outlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },

  text: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  outlinedText: {
    color: COLORS.primary,
  },
});