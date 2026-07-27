import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function ProfileLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
    }}>
      <Stack.Screen name="edit" options={{ title: 'Edit profile' }} />
    </Stack>
  );
}
