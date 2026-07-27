import { fireEvent, render } from '@testing-library/react-native';

import { BrandLockup, Button, ErrorState, Input, Skeleton } from '@/components/ui';
import { darkColors, elevation, lightColors, radii } from '@/theme';
import { expectAccessibleTouchTarget } from './helpers/accessibility';

describe('design system accessibility', () => {
  it('gives Button a role, label, disabled state, and minimum touch target', async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<Button disabled label="Save profile" onPress={onPress} />);
    const button = getByRole('button', { name: 'Save profile' });
    expect(button.props.accessibilityState).toMatchObject({ busy: false, disabled: true });
    expectAccessibleTouchTarget(button);
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('associates Input with its visible label and announces validation errors', async () => {
    const { getByLabelText, getByText } = await render(<Input error="Email is required" label="Email address" />);
    const input = getByLabelText('Email address');
    const label = getByText('Email address');
    const error = getByText('Email is required');
    expect(input.props.accessibilityLabelledBy).toBe(label.props.nativeID);
    expect(input.props['aria-invalid']).toBe(true);
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expectAccessibleTouchTarget(input);
  });

  it('invokes ErrorState retry and exposes the error as an assertive alert', async () => {
    const onRetry = jest.fn();
    const { getByRole } = await render(<ErrorState onRetry={onRetry} retryLabel="Retry loading" />);
    expect(getByRole('alert').props.accessibilityLiveRegion).toBe('assertive');
    const retry = getByRole('button', { name: 'Retry loading' });
    expectAccessibleTouchTarget(retry);
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides decorative Skeleton elements from the accessibility tree', async () => {
    const { root } = await render(<Skeleton />);
    expect(root?.props.accessibilityElementsHidden).toBe(true);
    expect(root?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('exposes the official Octamy brand lockup to assistive technology', async () => {
    const { getByLabelText } = await render(<BrandLockup />);
    expect(getByLabelText('Octamy. Professional certification and skill evidence.')).toBeTruthy();
  });

  it('keeps the visual foundation monochrome, compact, and shadow-free', () => {
    expect(lightColors.accent).toBe(lightColors.foreground);
    expect(darkColors.accent).toBe(darkColors.foreground);
    expect(radii.lg).toBeLessThanOrEqual(8);
    expect(elevation.low).toEqual({});
    expect(elevation.neo).toEqual({});
  });
});