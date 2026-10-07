import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AppLoading from '../AppLoading';
import { resetNativeQueueMutationLockForTests, runExclusiveNativeQueueReplacement } from '../../utils/nativeQueueMutationLock';
import { getNativePlaybackWatchdogSnapshot } from '../../utils/nativePlaybackWatchdog';

const mockAppTheme = {
  palette: {
    background: '#08090B',
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    borderStrong: 'rgba(210, 218, 230, 0.28)',
    primary: '#D8DEE8',
    text: {
      primary: '#F4F5F7',
      secondary: 'rgba(244, 245, 247, 0.70)',
    },
  },
};

const mockUseOptionalAppTheme = jest.fn();

jest.mock('../../contexts/AppThemeContext', () => ({
  useOptionalAppTheme: () => mockUseOptionalAppTheme(),
}));

beforeEach(() => {
  resetNativeQueueMutationLockForTests();
  mockUseOptionalAppTheme.mockReset();
  mockUseOptionalAppTheme.mockReturnValue({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: () => undefined,
    setSkin: () => undefined,
    theme: mockAppTheme,
  });
});

test('renders themed loading container', () => {
  const { getByTestId } = render(<AppLoading />);
  const style = StyleSheet.flatten(getByTestId('app-loading').props.style);

  expect(style.flex).toBe(1);
  expect(style.backgroundColor).toBe(mockAppTheme.palette.background);
});

test('renders branded loading copy and spinner', () => {
  const { getByTestId, getByText } = render(<AppLoading />);
  const logoStyle = JSON.stringify(getByTestId('app-loading-logo').props.style);

  expect(getByText('k1w1-Musik')).toBeTruthy();
  expect(getByText('Deine Bibliothek wird vorbereitet')).toBeTruthy();
  expect(getByTestId('app-loading-spinner')).toBeTruthy();
  expect(logoStyle).toContain(mockAppTheme.palette.surfaceGlass);
  expect(logoStyle).toContain(mockAppTheme.palette.borderStrong);
});

test('renders safely before the app theme provider is mounted', () => {
  mockUseOptionalAppTheme.mockReturnValue(null);

  const { getByTestId, getByText } = render(<AppLoading />);

  expect(getByTestId('app-loading')).toBeTruthy();
  expect(getByText('k1w1-Musik')).toBeTruthy();
});

test('renders a visible degraded message and retry action', () => {
  const onRetry = jest.fn();
  const { getByTestId, getByText, queryByTestId } = render(<AppLoading degraded onRetry={onRetry} />);
  expect(getByText('Die Wiedergabewarteschlange konnte nicht bestätigt werden.')).toBeTruthy();
  expect(queryByTestId('app-loading-spinner')).toBeNull();
  expect(getByTestId('hydration-retry-button').props.accessibilityLabel).toBe('Erneut versuchen');
  fireEvent.press(getByTestId('hydration-retry-button'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('explains a stalled player and keeps retry disabled until the native operation settles', async () => {
  jest.useFakeTimers();
  const onRetry = jest.fn();
  const view = render(<AppLoading degraded onRetry={onRetry} />);
  let started!: () => void; let release!: () => void;
  const began = new Promise<void>(resolve => { started = resolve; });
  const operation = runExclusiveNativeQueueReplacement(async () => {
    started(); await new Promise<void>(resolve => { release = resolve; });
  }, { timeoutMs: 40 });
  const outcome = operation.catch(error => error);
  await began;
  await act(async () => { await jest.advanceTimersByTimeAsync(40); await outcome; });
  expect(view.getByTestId('app-loading-subtitle').props.children).toContain('Der Player reagiert nicht.');
  expect(view.getByTestId('hydration-retry-button').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(view.getByTestId('hydration-retry-button'));
  expect(onRetry).not.toHaveBeenCalled();
  await act(async () => { release(); await jest.advanceTimersByTimeAsync(0); });
  expect(view.getByTestId('hydration-retry-button').props.accessibilityState.disabled).toBe(false);
  fireEvent.press(view.getByTestId('hydration-retry-button'));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(getNativePlaybackWatchdogSnapshot().status).toBe('retry-required');
  view.unmount(); jest.useRealTimers();
});
