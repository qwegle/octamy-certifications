import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function PracticeLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
    }}>
      <Stack.Screen name="[courseId]" options={{ title: 'Practice assessment' }} />
      <Stack.Screen name="attempt/[courseId]" options={{ title: 'Practice run' }} />
      <Stack.Screen name="results/[tempExamId]" options={{ title: 'Practice result' }} />
    </Stack>
  );
}
