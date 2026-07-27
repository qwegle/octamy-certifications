import type { TextStyle, ViewStyle } from 'react-native';

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

export const radii = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 42, lineHeight: 48, fontWeight: '700', letterSpacing: -1.5 },
  h1: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.9 },
  h2: { fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.35 },
  h3: { fontSize: 19, lineHeight: 25, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0.05 },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.25 },
} as const satisfies Record<string, TextStyle>;

export const layout = {
  authMaxWidth: 1040,
  contentMaxWidth: 1120,
  readingMaxWidth: 680,
} as const;

// Octamy uses flat surfaces. These aliases remain for feature compatibility.
export const elevation = {
  none: {} satisfies ViewStyle,
  low: {} satisfies ViewStyle,
  medium: {} satisfies ViewStyle,
  neo: {} satisfies ViewStyle,
} as const;

export const minimumTouchTarget = 44;
