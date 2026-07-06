import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import LibraryPlaybackActions from '../LibraryPlaybackActions';

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    text: {
      primary: '#F4F5F7',
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

test('renders favorite indicator when requested', () => {
  const { getByTestId } = render(<LibraryPlaybackActions disabled={false} showFavoriteIcon onShuffle={jest.fn()} onPlay={jest.fn()} />);

  expect(getByTestId('library-favorites-indicator')).toBeTruthy();
});

test('calls shuffle and play callbacks', () => {
  const onShuffle = jest.fn();
  const onPlay = jest.fn();
  const { getByTestId } = render(<LibraryPlaybackActions disabled={false} onShuffle={onShuffle} onPlay={onPlay} />);

  fireEvent.press(getByTestId('library-shuffle-button'));
  fireEvent.press(getByTestId('library-play-button'));

  expect(onShuffle).toHaveBeenCalledTimes(1);
  expect(onPlay).toHaveBeenCalledTimes(1);
});

test('disables shuffle and play buttons', () => {
  const onShuffle = jest.fn();
  const onPlay = jest.fn();
  const { getByTestId } = render(<LibraryPlaybackActions disabled onShuffle={onShuffle} onPlay={onPlay} />);

  expect(getByTestId('library-shuffle-button').props.accessibilityState.disabled).toBe(true);
  expect(getByTestId('library-play-button').props.accessibilityState.disabled).toBe(true);
  fireEvent.press(getByTestId('library-shuffle-button'));
  fireEvent.press(getByTestId('library-play-button'));

  expect(onShuffle).not.toHaveBeenCalled();
  expect(onPlay).not.toHaveBeenCalled();
});

test('uses app theme chrome for action buttons', () => {
  const { getByTestId } = render(<LibraryPlaybackActions disabled={false} onShuffle={jest.fn()} onPlay={jest.fn()} />);

  const shuffleStyle = JSON.stringify(getByTestId('library-shuffle-button').props.style);
  const playStyle = JSON.stringify(getByTestId('library-play-button').props.style);

  expect(shuffleStyle).toContain(mockAppTheme.palette.surfaceGlass);
  expect(shuffleStyle).toContain(mockAppTheme.palette.border);
  expect(playStyle).toContain(mockAppTheme.palette.surfaceGlass);
  expect(playStyle).toContain(mockAppTheme.palette.border);
});
