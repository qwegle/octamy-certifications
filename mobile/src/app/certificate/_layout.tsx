import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function CertificateLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
    }}>
      <Stack.Screen name="index" options={{ title: 'My certificates' }} />
      <Stack.Screen name="verify" options={{ title: 'Verify certificate' }} />
      <Stack.Screen name="[certificateId]" options={{ title: 'Certificate' }} />
    </Stack>
  );
}
