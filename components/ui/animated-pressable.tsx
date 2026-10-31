import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";
import { ANIMATION } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
interface Props extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children: React.ReactNode;
}
export default function AnimatedPressable({
  style,
  scaleTo = ANIMATION.press.scaleTo,
  children,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current,
    reduced = useReducedMotion();
  const animateTo = (value: number) => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) animateTo(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View
        style={[style, { transform: [{ scale: reduced ? 1 : scale }] }]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
