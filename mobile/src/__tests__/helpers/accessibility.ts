import type { TestInstance } from 'test-renderer';
import { StyleSheet } from 'react-native';

const MINIMUM_TOUCH_TARGET = 44;

type PressState = { focused: boolean; hovered: boolean; pressed: boolean };

export function expectAccessibleTouchTarget(element: TestInstance): void {
  const label = element.props.accessibilityLabel as unknown;
  expect(typeof label === 'string' && label.trim().length > 0).toBe(true);

  const rawStyle = typeof element.props.style === 'function'
    ? element.props.style({ focused: false, hovered: false, pressed: false } satisfies PressState)
    : element.props.style;
  const style = StyleSheet.flatten(rawStyle) ?? {};
  const height = typeof style.minHeight === 'number' ? style.minHeight : style.height;
  const width = typeof style.minWidth === 'number' ? style.minWidth : style.width;

  expect(typeof height === 'number' && height >= MINIMUM_TOUCH_TARGET).toBe(true);
  expect(typeof width === 'number' && width >= MINIMUM_TOUCH_TARGET).toBe(true);
}
