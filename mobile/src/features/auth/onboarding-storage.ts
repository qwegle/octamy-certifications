import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ONBOARDING_KEY = 'octamy.onboarding.completed.v1';
let memoryFallback = false;

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  if (Platform.OS === 'web') return webStorage()?.getItem(ONBOARDING_KEY) === 'true' || memoryFallback;
  return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'true';
}

export async function completeOnboarding(): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = webStorage();
    if (storage) storage.setItem(ONBOARDING_KEY, 'true');
    else memoryFallback = true;
    return;
  }
  await SecureStore.setItemAsync(ONBOARDING_KEY, 'true', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
