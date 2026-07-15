// components/ui/skeleton.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

import { COLORS, RADIUS } from '../../constants/theme';

interface Props {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single shimmering placeholder block. Compose a few of these
 * to build skeleton versions of real cards (see home.tsx).
 */
export default function Skeleton({ width = '100%', height = 16, radius = RADIUS.sm, style }: Props) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: COLORS.skeletonBase,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}