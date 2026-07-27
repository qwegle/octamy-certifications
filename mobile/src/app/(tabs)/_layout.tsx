import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { minimumTouchTarget, spacing, useAppTheme } from '@/theme';

type TabName = 'certifications' | 'index' | 'interview' | 'practice' | 'profile';

function TabIcon({ color, focused, name }: { color: ColorValue; focused: boolean; name: TabName }) {
  const ink = { borderColor: color };
  const fill = { backgroundColor: color };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.iconFrame}>
      {name === 'index' ? (
        <View style={styles.gridIcon}>
          {[0, 1, 2, 3].map((cell) => <View key={cell} style={[styles.gridCell, focused ? fill : ink, !focused && styles.outlineCell]} />)}
        </View>
      ) : name === 'certifications' ? (
        <View style={[styles.document, ink]}>
          <View style={[styles.documentLine, fill]} /><View style={[styles.documentLineShort, fill]} />
        </View>
      ) : name === 'practice' ? (
        <View style={[styles.target, ink, focused && styles.targetStrong]}><View style={[styles.targetDot, fill]} /></View>
      ) : name === 'interview' ? (
        <View style={[styles.message, ink, focused && fill]}><View style={[styles.messageLine, { backgroundColor: focused ? '#000000' : color }]} /></View>
      ) : (
        <View style={styles.profileIcon}>
          <View style={[styles.profileHead, focused ? fill : ink]} />
          <View style={[styles.profileBody, ink, focused && fill]} />
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 74,
          paddingBottom: spacing.sm,
          paddingTop: spacing.sm,
        },
        tabBarItemStyle: { minHeight: minimumTouchTarget },
      }}>
      <Tabs.Screen name="index" options={{ tabBarAccessibilityLabel: 'Home tab', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="index" />, title: 'Home' }} />
      <Tabs.Screen name="certifications" options={{ tabBarAccessibilityLabel: 'Certifications tab', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="certifications" />, title: 'Certify' }} />
      <Tabs.Screen name="practice" options={{ tabBarAccessibilityLabel: 'Practice tab', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="practice" />, title: 'Practice' }} />
      <Tabs.Screen name="interview" options={{ tabBarAccessibilityLabel: 'Interview tab', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="interview" />, title: 'Interview' }} />
      <Tabs.Screen name="profile" options={{ tabBarAccessibilityLabel: 'Profile tab', tabBarIcon: ({ color, focused }) => <TabIcon color={color} focused={focused} name="profile" />, title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  document: { borderWidth: 1.5, height: 22, justifyContent: 'center', paddingHorizontal: 4, width: 18 },
  documentLine: { height: 1.5, marginBottom: 4, width: 8 },
  documentLineShort: { height: 1.5, width: 5 },
  gridCell: { height: 7, width: 7 },
  gridIcon: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, height: 17, width: 17 },
  iconFrame: { alignItems: 'center', height: 24, justifyContent: 'center', width: 26 },
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 0.35 },
  message: { alignItems: 'center', borderRadius: 2, borderWidth: 1.5, height: 18, justifyContent: 'center', width: 22 },
  messageLine: { height: 1.5, width: 9 },
  outlineCell: { backgroundColor: 'transparent', borderWidth: 1.25 },
  profileBody: { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderWidth: 1.5, height: 9, width: 20 },
  profileHead: { borderRadius: 5, borderWidth: 1.5, height: 10, width: 10 },
  profileIcon: { alignItems: 'center', gap: 2 },
  target: { alignItems: 'center', borderRadius: 11, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  targetDot: { borderRadius: 3, height: 6, width: 6 },
  targetStrong: { borderWidth: 2.5 },
});
