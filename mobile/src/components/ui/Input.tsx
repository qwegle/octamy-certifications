import { useId, useState, type ComponentProps } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { minimumTouchTarget, radii, spacing, typography, useAppTheme } from '@/theme';
import { Text } from './Text';

type NativeInputProps = ComponentProps<typeof TextInput>;

export interface InputProps extends NativeInputProps {
  error?: string;
  hint?: string;
  label: string;
}

export function Input({ error, hint, label, onBlur, onFocus, style, ...props }: InputProps) {
  const reactId = useId();
  const labelId = `input-label-${reactId.replace(/:/g, '')}`;
  const [focused, setFocused] = useState(false);
  const { colors } = useAppTheme();

  return (
    <View style={styles.group}>
      <Text nativeID={labelId} variant="label">{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityLabelledBy={labelId}
        accessibilityState={{ disabled: props.editable === false }}
        aria-invalid={Boolean(error)}
        cursorColor={colors.foreground}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.foreground}
        style={[
          styles.input,
          typography.body,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.destructive : focused ? colors.focus : colors.border,
            borderWidth: focused || error ? 2 : 1,
            color: colors.foreground,
          },
          style,
        ]}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.destructive }} variant="small">{error}</Text>
      ) : hint ? (
        <Text muted variant="small">{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  input: {
    borderRadius: radii.sm,
    minHeight: 52,
    minWidth: minimumTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
