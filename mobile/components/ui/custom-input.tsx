import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

interface CustomInputProps
  extends TextInputProps {}



export default function CustomInput({
  ...props

  
}: CustomInputProps) {

   const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.input,
          props.secureTextEntry && styles.passwordInput,
        ]}
        placeholderTextColor={COLORS.gray}
        {...props}
        secureTextEntry={
          props.secureTextEntry ? !showPassword : false
        }
      />

      {props.secureTextEntry && (
        <Pressable
          style={styles.eyeButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons
            name={showPassword ? 'eye-outline' : 'eye-off-outline'}
            size={22}
            color={COLORS.gray}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    marginBottom: 14,
  },

  input: {
    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: '#E5E5E5',

    paddingVertical: 12,
    paddingHorizontal: 18,

    borderRadius: 14,

    fontSize: 15,
    color: COLORS.text,

    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  passwordInput: {
  paddingRight: 50,
  },

  eyeButton: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -11 }],
  },

});