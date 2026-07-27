import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function SettingsLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
    }}>
      <Stack.Screen name="privacy" options={{ title: 'Privacy & evidence' }} />
      <Stack.Screen name="evidence-sharing" options={{ title: 'Recruiter evidence sharing' }} />
    </Stack>
  );
}
