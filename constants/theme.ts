// constants/theme.ts

export const COLORS = {
  // Brand
  primary: "#660810",
  primaryLight: "#8A2E35",
  primaryDark: "#450509",
  secondary: "#1D2939",

  // Neutrals
  background: "#FAF7F7",
  accent: "#E9E1E2",
  white: "#FFFFFF",
  text: "#182230",
  gray: "#5D6878",
  lightGray: "#EFF2F5",
  border: "#E3E7ED",
  overlay: "rgba(16,24,40,0.48)",

  // Cream surfaces — used instead of flat white so cards feel
  // warmer and sit naturally on the maroon/cream brand palette.
  cream: "#FFFFFF",
  creamDark: "#F0F3F6",
  accentSoft: "#F2E8E8",
  primarySoft: "#F7F3F3",
  primaryTint: "#F3EBEC",

  // Status / feedback
  success: "#166448",
  successLight: "#E9F5EE",
  warning: "#805218",
  warningLight: "#FFF4E1",
  info: "#245EA8",
  infoLight: "#EBF2FC",
  purple: "#6842A0",
  purpleLight: "#F1EBF9",
  danger: "#B42334",
  dangerLight: "#FDECEE",
  dangerDark: "#B42334",

  // Skeleton loading
  skeletonBase: "#E3E7ED",
  skeletonHighlight: "#F7F8FA",
};

// Maps a queue status string to its display color, used across
// the home screen badge and the queue details card.
export const STATUS_COLORS: Record<string, string> = {
  reserved: COLORS.info,
  expired: COLORS.gray,
  waiting: COLORS.warning,
  next: COLORS.info,
  called: COLORS.info,
  in_progress: COLORS.purple,
  completed: COLORS.success,
  done: COLORS.success,
  cancelled: COLORS.danger,
};

// Soft tinted background to pair with each STATUS_COLORS entry,
// used for pill / badge backgrounds.
export const STATUS_BG: Record<string, string> = {
  reserved: COLORS.infoLight,
  expired: COLORS.lightGray,
  waiting: COLORS.warningLight,
  next: COLORS.infoLight,
  called: COLORS.infoLight,
  in_progress: COLORS.purpleLight,
  completed: COLORS.successLight,
  done: COLORS.successLight,
  cancelled: COLORS.dangerLight,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 12,
  xl: 12,
  xxl: 12,
  full: 999,
};

// Elevation presets — combine iOS shadow props with Android
// elevation so cards read as "floating" consistently on both.
export const SHADOWS = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 6,
    elevation: 1,
  },
  md: {
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  lg: {
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 22,
    elevation: 3,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2,
  },
};

// Typography scale — a clear, intentional hierarchy so every
// screen reaches for the same handful of text styles.
export const TYPOGRAPHY = {
  display: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h1: {
    fontSize: 22,
    fontWeight: "700" as const,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h2: {
    fontSize: 18,
    fontWeight: "700" as const,
    lineHeight: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: "700" as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodyStrong: {
    fontSize: 16,
    fontWeight: "700" as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: "700" as const,
    lineHeight: 20,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
};

export const ICON_SIZES = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

// Animation durations (ms) + easing reference for consistent motion.
export const ANIMATION = {
  fast: 150,
  base: 240,
  slow: 400,
  press: {
    scaleTo: 0.97,
  },
};

export const OPACITY = {
  disabled: 0.45,
  pressed: 0.85,
  subtle: 0.6,
};
// Expo template compatibility; app components use the shared COLORS palette.
export const Colors = {
  light: {
    text: COLORS.text,
    background: COLORS.background,
    tint: COLORS.primary,
    icon: COLORS.gray,
    tabIconDefault: COLORS.gray,
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text: "#fff",
    background: "#191919",
    tint: "#e5b9bc",
    icon: "#bbb",
    tabIconDefault: "#bbb",
    tabIconSelected: "#e5b9bc",
  },
};
