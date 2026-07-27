import 'react-native-reanimated';
import '@/lib/register-user-data-cleaners';

import { type Href, DarkTheme, DefaultTheme, Stack, ThemeProvider, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/features/auth';
import { FeedbackProvider } from '@/lib/feedback';
import { GlobalNetworkBanner, MobileQueryProvider } from '@/lib/query';
import { useAppTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const loginHref = '/(auth)/login' as Href;
const tabsHref = '/(tabs)' as Href;

function SessionGate() {
  const { status } = useSession();
  const { colors } = useAppTheme();
  const segments = useSegments();
  const firstSegment = segments[0] as string | undefined;
  const routePath = segments.join('/');
  const inAuth = firstSegment === '(auth)';
  const isPublicVerification = routePath === 'certificate/verify';
  const atRoot = firstSegment === undefined;
  const isAuthenticated = status === 'authenticated' || status === 'authenticatedOffline';
  const needsLogin = status === 'anonymous' && !inAuth && !isPublicVerification && !atRoot;
  const needsTabs = isAuthenticated && (inAuth || atRoot);

  useEffect(() => {
    if (status === 'booting') return;
    if (needsLogin) {
      router.replace(loginHref);
      return;
    }
    if (needsTabs) {
      router.replace(tabsHref);
      return;
    }
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [needsLogin, needsTabs, status]);

  if (status !== 'booting' && !needsLogin && !needsTabs) return null;
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.gate, { backgroundColor: colors.background }]} />;
}

function NavigationRoot() {
  const { colors, isDark } = useAppTheme();
  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      primary: colors.accent,
      text: colors.foreground,
      notification: colors.accent,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="certification" />
        <Stack.Screen name="exam" />
        <Stack.Screen name="certificate" />
        <Stack.Screen name="practice" />
        <Stack.Screen name="interview" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
      </Stack>
      <SessionGate />
      <GlobalNetworkBanner />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <MobileQueryProvider>
          <SessionProvider>
            <FeedbackProvider>
              <NavigationRoot />
            </FeedbackProvider>
          </SessionProvider>
        </MobileQueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gate: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 2000 },
  root: { flex: 1 },
});
