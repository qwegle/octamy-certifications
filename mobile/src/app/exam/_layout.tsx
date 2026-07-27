import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function ExamLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
    }}>
      <Stack.Screen name="[courseId]" options={{ title: 'Certification exam' }} />
      <Stack.Screen name="result/[tempExamId]" options={{ title: 'Exam result' }} />
    </Stack>
  );
}
