import React from 'react';
import { render } from '@testing-library/react-native';
import ProgressBar, {
  clampPlaybackProgressValues,
  clampRatio,
  ratioToMillis,
  resolveDragRatio,
} from '../ProgressBar';

const mockAppTheme = {
  palette: {
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    primaryDark: '#87909E',
    text: {
      secondary: 'rgba(244, 245, 247, 0.70)',
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    theme: mockAppTheme,
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
  }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

test('clamps playback progress values', () => {
  expect(clampPlaybackProgressValues(50, 100)).toEqual({ currentPosition: 50, duration: 100, progress: 50 });
  expect(clampPlaybackProgressValues(150, 100)).toEqual({ currentPosition: 100, duration: 100, progress: 100 });
  expect(clampPlaybackProgressValues(-1, 0)).toEqual({ currentPosition: 0, duration: 0, progress: 0 });
});

test('clamps ratios and resolves drag positions', () => {
  expect(clampRatio(-1)).toBe(0);
  expect(clampRatio(2)).toBe(1);
  expect(resolveDragRatio(0.5, 25, 100)).toBe(0.75);
  expect(ratioToMillis(0.5, 1000)).toBe(500);
});

test('renders progress with app theme colors', () => {
  const { getAllByText, getByTestId } = render(
    <ProgressBar currentPosition={30_000} duration={60_000} onSeek={jest.fn()} />,
  );

  expect(getByTestId('progress-bar').props.accessibilityValue.now).toBe(50);
  expect(JSON.stringify(getByTestId('progress-bar-track').props.style)).toContain(mockAppTheme.palette.border);
  expect(JSON.stringify(getByTestId('progress-bar-fill').props.colors)).toContain(mockAppTheme.palette.primary);
  expect(JSON.stringify(getByTestId('progress-bar-thumb').props.style)).toContain(mockAppTheme.palette.primary);
  expect(JSON.stringify(getAllByText('0:30')[0].props.style)).toContain(mockAppTheme.palette.text.secondary);
});

test('prefers explicit accent colors for fill and thumb', () => {
  const { getByTestId } = render(
    <ProgressBar currentPosition={30_000} duration={60_000} onSeek={jest.fn()} accent="#123456" accentDark="#654321" />,
  );

  expect(getByTestId('progress-bar-fill').props.colors).toEqual(['#123456', '#654321']);
  expect(JSON.stringify(getByTestId('progress-bar-thumb').props.style)).toContain('#123456');
});
