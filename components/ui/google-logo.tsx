import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * Official Google "G" mark.
 * Uses Google's hosted brand asset (same one used in Sign in with Google docs).
 */
export default function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={{
          uri: 'https://developers.google.com/identity/images/g-logo.png',
        }}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Google"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
