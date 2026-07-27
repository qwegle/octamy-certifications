import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { spacing, useAppTheme } from '@/theme';
import { Text } from './Text';

const logoOnLight = require('../../../assets/images/octamy-logo-on-light.png');
const logoOnDark = require('../../../assets/images/octamy-logo-on-dark.png');
const logoRatio = 891 / 271;

export interface BrandMarkProps {
  inverse?: boolean;
  size?: number;
}

/** Official Octamy lockup supplied by the product owner. `size` is its height. */
export function BrandMark({ inverse = false, size = 44 }: BrandMarkProps) {
  const { colors, isDark } = useAppTheme();
  const useLightArtwork = inverse || isDark;
  const width = Math.round(size * logoRatio);
  return (
    <View style={{ height: size, position: 'relative', width }}>
      {!useLightArtwork ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.symbolPlate, { backgroundColor: colors.foreground, height: Math.round(size * 0.67), width: Math.round(size * 0.96) }]}
        />
      ) : null}
      <Image accessibilityLabel="Octamy" contentFit="contain" source={useLightArtwork ? logoOnDark : logoOnLight} style={StyleSheet.absoluteFill} />
    </View>
  );
}

export interface BrandLockupProps {
  compact?: boolean;
  inverse?: boolean;
  tagline?: boolean;
}

export function BrandLockup({ compact = false, inverse = false, tagline = true }: BrandLockupProps) {
  const { colors } = useAppTheme();
  const mutedColor = inverse ? colors.onPrimary : colors.textMuted;
  return (
    <View accessible accessibilityLabel="Octamy. Professional certification and skill evidence." style={styles.lockup}>
      <BrandMark inverse={inverse} size={compact ? 38 : 50} />
      {tagline ? <Text style={[styles.tagline, { color: mutedColor }]}>PROFESSIONAL CERTIFICATION</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'flex-start', gap: spacing.xs },
  symbolPlate: { left: 0, position: 'absolute', top: 0 },
  tagline: { fontSize: 9, fontWeight: '700', letterSpacing: 1.8, lineHeight: 12, marginLeft: 2 },
});
