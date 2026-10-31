import React from "react";
import { Image, StyleSheet, View } from "react-native";

/**
 * Official Google "G" mark.
 * Bundled from Google's public sign-in asset so the mark also renders offline.
 */
export default function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={require("../../assets/images/google-g.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Google"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
