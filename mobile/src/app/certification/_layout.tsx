import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function CertificationLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
      title: 'Certification',
    }} />
  );
}
