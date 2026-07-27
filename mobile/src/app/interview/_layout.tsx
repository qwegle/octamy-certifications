import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme';

export default function InterviewLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack screenOptions={{
      contentStyle: { backgroundColor: colors.background },
      headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.foreground,
    }}>
      <Stack.Screen name="session" options={{ title: 'Interview practice' }} />
      <Stack.Screen name="introduction" options={{ title: 'Personal introduction' }} />
      <Stack.Screen name="recordings" options={{ title: 'Local recordings' }} />
      <Stack.Screen name="consent" options={{ headerShown: false }} />
      <Stack.Screen name="capture" options={{ headerShown: false }} />
    </Stack>
  );
}
