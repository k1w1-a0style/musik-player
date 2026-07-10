import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingQueueCard from '../NowPlayingQueueCard';
import type { Song } from '../../types/Song';
import { getAppTheme } from '../../utils/appTheme';
let mockAppTheme: {
  appearance: 'dark' | 'light';
  skin: 'graphite';
  isHydrated: boolean;
  setAppearance: () => undefined;
  setSkin: () => undefined;
  theme: ReturnType<typeof getAppTheme>;
} = {
  appearance: 'dark',
  skin: 'graphite' as const,
  isHydrated: true,
  setAppearance: () => undefined,
  setSkin: () => undefined,
  theme: getAppTheme('dark', 'graphite'),
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppTheme,
  useOptionalAppTheme: () => mockAppTheme,
}));

const queue: Song[] = [
  { id: 's1', title: 'One', artist: 'A' },
  { id: 's2', title: 'Two', artist: 'B' },
  { id: 's3', title: 'Three', artist: 'C' },
];

test('renders drag handles for upcoming tracks only', () => {
  const onPlayQueueItem = jest.fn();
  const onQueueShift = jest.fn();
  const { getByTestId, queryByTestId } = render(
    <NowPlayingQueueCard
      queue={queue}
      currentSongId="s1"
      maxHeight={240}
      onPlayQueueItem={onPlayQueueItem}
      onQueueShift={onQueueShift}
      canShiftQueue
      accentColor="#3366FF"
    />,
  );

  expect(queryByTestId('queue-drag-handle-s1')).toBeNull();
  expect(getByTestId('queue-drag-handle-s2')).toBeTruthy();
  expect(getByTestId('queue-drag-handle-s3')).toBeTruthy();

  fireEvent.press(getByTestId('queue-row-s2'));
  expect(onPlayQueueItem).toHaveBeenCalledWith('s2');
});

test('uses row text contrast instead of foregroundOnAccent for active text while preserving accent affordances', () => {
  const longQueue: Song[] = [
    { id: 's1', title: 'One'.repeat(40), artist: 'Artist '.repeat(30) },
    { id: 's2', title: 'Two', artist: 'B' },
  ];

  const { getByTestId, getByText } = render(
    <NowPlayingQueueCard
      queue={longQueue}
      currentSongId="s1"
      maxHeight={240}
      onPlayQueueItem={jest.fn()}
      onQueueShift={jest.fn()}
      canShiftQueue
      accentColor="#F9E27D"
    />,
  );

  expect(JSON.stringify(getByText(longQueue[0].title).props.style)).toContain(mockAppTheme.theme.palette.text.primary);
  expect(JSON.stringify(getByText('Aktiv').props.style)).toContain(mockAppTheme.theme.palette.text.primary);
  expect(JSON.stringify(getByText(longQueue[0].title).props.style)).not.toContain('#101820');
  expect(JSON.stringify(getByText('Aktiv').props.style)).not.toContain('#101820');

  expect(JSON.stringify(getByTestId('queue-row-s1').props.style)).toContain('#F9E27D');
  expect(JSON.stringify(getByTestId('queue-active-indicator-s1').props.style)).toContain('#F9E27D');
  expect(JSON.stringify(getByTestId('queue-accent-bar-s1').props.style)).toContain('#F9E27D');
  expect(getByTestId('queue-active-icon-s1')).toBeTruthy();
  expect(getByTestId('queue-row-s1').props.accessibilityState).toEqual({ selected: true });
  expect(getByText(longQueue[0].title).props.numberOfLines).toBe(1);
  expect(getByText(longQueue[0].title).props.ellipsizeMode).toBe('tail');
  expect(getByText(longQueue[0].artist).props.numberOfLines).toBe(1);
  expect(getByText(longQueue[0].artist).props.ellipsizeMode).toBe('tail');
});


test('uses display title fallback for placeholder queue titles', () => {
  const { getByText, queryByText } = render(
    <NowPlayingQueueCard
      queue={[{ id: 's1', title: 'unknown', artist: 'Artist', fileInfo: { filename: 'Artist - Song.mp4' } }]}
      currentSongId="s1"
      maxHeight={240}
      onPlayQueueItem={jest.fn()}
      onQueueShift={jest.fn()}
      canShiftQueue
      accentColor="#3366FF"
    />,
  );

  expect(queryByText('unknown')).toBeNull();
  expect(getByText('Song')).toBeTruthy();
});


test('does not expose drag handles before the current track', () => {
  const { getByTestId, queryByTestId } = render(
    <NowPlayingQueueCard
      queue={queue}
      currentSongId="s2"
      maxHeight={240}
      onPlayQueueItem={jest.fn()}
      onQueueShift={jest.fn()}
      canShiftQueue
      accentColor="#33B5FF"
    />,
  );

  expect(queryByTestId('queue-drag-handle-s1')).toBeNull();
  expect(queryByTestId('queue-drag-handle-s2')).toBeNull();
  expect(getByTestId('queue-drag-handle-s3')).toBeTruthy();
});

test.each(['light', 'dark'] as const)('renders queue card and preview row with %s app theme without crashing', appearance => {
  mockAppTheme = {
    ...mockAppTheme,
    appearance,
    theme: getAppTheme(appearance, 'graphite'),
  };

  const { getByTestId, getByText, unmount } = render(
    <NowPlayingQueueCard
      queue={queue}
      currentSongId="s1"
      maxHeight={240}
      onPlayQueueItem={jest.fn()}
      onQueueShift={jest.fn()}
      canShiftQueue
      accentColor="#33B5FF"
    />,
  );

  expect(getByTestId('queue-row-s1')).toBeTruthy();
  expect(JSON.stringify(getByText('One').props.style)).toContain(mockAppTheme.theme.palette.text.primary);
  expect(JSON.stringify(getByText('A').props.style)).toContain(mockAppTheme.theme.palette.text.secondary);
  expect(JSON.stringify(getByTestId('queue-accent-bar-s2').props.style)).toContain(mockAppTheme.theme.palette.border);

  unmount();
  mockAppTheme = {
    ...mockAppTheme,
    appearance: 'dark',
    theme: getAppTheme('dark', 'graphite'),
  };
});
