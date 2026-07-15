// constants/theme.ts

export const COLORS = {
  // Brand
  primary: '#660810',
  primaryLight: '#8a2e35',
  primaryDark: '#450509',
  secondary: '#270707',

  // Neutrals
  background: '#f1ebeb',
  accent: '#d6c0b1',
  white: '#FFFFFF',
  text: '#1f1f1f',
  gray: '#7A7A7A',
  lightGray: '#f2f2f2',
  border: 'rgba(102,8,16,0.08)',
  overlay: 'rgba(39,7,7,0.55)',

  // Cream surfaces — used instead of flat white so cards feel
  // warmer and sit naturally on the maroon/cream brand palette.
  cream: '#faf6f3',
  creamDark: '#efe4dc',
  accentSoft: 'rgba(214,192,177,0.35)',
  primarySoft: 'rgba(102,8,16,0.06)',
  primaryTint: 'rgba(102,8,16,0.10)',

  // Status / feedback
  success: '#2E7D32',
  successLight: '#DFF6DD',
  warning: '#F39C12',
  warningLight: '#FCEED8',
  info: '#1976D2',
  infoLight: '#DCEBFB',
  purple: '#7B1FA2',
  purpleLight: '#F0E0F6',
  danger: '#C62828',
  dangerLight: '#FBE0E0',
  dangerDark: '#D32F2F',

  // Skeleton loading
  skeletonBase: '#e8dfda',
  skeletonHighlight: '#f5efeb',
};

// Maps a queue status string to its display color, used across
// the home screen badge and the queue details card.
export const STATUS_COLORS: Record<string, string> = {
  waiting: COLORS.warning,
  called: COLORS.info,
  in_progress: COLORS.purple,
  completed: COLORS.success,
  cancelled: COLORS.danger,
};

// Soft tinted background to pair with each STATUS_COLORS entry,
// used for pill / badge backgrounds.
export const STATUS_BG: Record<string, string> = {
  waiting: COLORS.warningLight,
  called: COLORS.infoLight,
  in_progress: COLORS.purpleLight,
  completed: COLORS.successLight,
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
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// Elevation presets — combine iOS shadow props with Android
// elevation so cards read as "floating" consistently on both.
export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  lg: {
    shadowColor: COLORS.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 8,
  },
  glow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
};

// Typography scale — a clear, intentional hierarchy so every
// screen reaches for the same handful of text styles.
export const TYPOGRAPHY = {
  display: {
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  h1: {
    fontSize: 22,
    fontWeight: '800' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 21,
  },
  bodyStrong: {
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
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