import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from './colors';

export * from './colors';
export * from './motion';
export * from './tokens';

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return {
    colorScheme: isDark ? 'dark' : 'light',
    isDark,
    colors: isDark ? darkColors : lightColors,
  } as const;
}
