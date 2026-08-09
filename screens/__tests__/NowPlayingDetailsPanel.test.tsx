import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NowPlayingDetailsPanel from '../NowPlayingDetailsPanel';
import type { Song } from '../../types/Song';
const mockAppTheme = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: () => undefined,
  setSkin: () => undefined,
  theme: {
    palette: {
      background: '#08090B',
      backgroundDeep: '#030406',
      surface: '#111318',
      surfaceElevated: '#191B21',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      accent: '#BFC7D4',
      text: {
        primary: '#F4F5F3',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#030406', '#08090B', '#0D1014'],
      nowPlaying: ['#030406', '#08090B', '#0D1014'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppTheme,
  useOptionalAppTheme: () => mockAppTheme,
}));

const queue: Song[] = [
  { id: 's1', title: 'One', artist: 'A' },
  { id: 's2', title: 'Two'.repeat(40), artist: 'Very Long Artist '.repeat(20) },
  { id: 's3', title: 'Three', artist: 'C' },
];

const renderPanel = (overrides: Partial<React.ComponentProps<typeof NowPlayingDetailsPanel>> = {}) => {
  const props: React.ComponentProps<typeof NowPlayingDetailsPanel> = {
    queue,
    currentSong: queue[0],
    albumTitle: 'Album should not render in queue details',
    accentMuted: '#3366FF',
    foregroundOnAccent: '#101820',
    listHeight: 220,
    onPlayQueueItem: jest.fn(),
    onQueueShift: jest.fn(),
    canShiftQueue: true,
    ...overrides,
  };

  return { ...render(<NowPlayingDetailsPanel {...props} />), props };
};

describe('NowPlayingDetailsPanel queue track list', () => {
  test('renders the queue as a plain track list without heavy header or metadata cards', () => {
    const { getByTestId, queryByTestId, queryByText } = renderPanel();

    expect(getByTestId('now-playing-queue-list-frame')).toBeTruthy();
    expect(queryByText('WARTESCHLANGE')).toBeNull();
    expect(queryByTestId('now-playing-details-card')).toBeNull();
    expect(queryByText('METADATEN')).toBeNull();
    expect(queryByText('Album should not render in queue details')).toBeNull();
  });

  test('keeps multiple tracks list-ready, calls onPlayQueueItem, and marks active track with accent color', () => {
    const { getByTestId, props } = renderPanel();

    expect(getByTestId('queue-row-s1')).toBeTruthy();
    expect(getByTestId('queue-row-s2')).toBeTruthy();
    expect(getByTestId('queue-row-s3')).toBeTruthy();
    expect(getByTestId('queue-active-indicator-s1')).toBeTruthy();

    expect(JSON.stringify(getByTestId('queue-row-s1').props.style)).toContain('#3366FF');

    fireEvent.press(getByTestId('queue-row-s2'));
    expect(props.onPlayQueueItem).toHaveBeenCalledWith('s2');
  });

  test('does not use foregroundOnAccent as active row text color on weakly tinted rows', () => {
    const { getByTestId, getByText } = renderPanel({
      accentMuted: '#F9E27D',
      foregroundOnAccent: '#101820',
    });

    expect(JSON.stringify(getByTestId('queue-row-s1').props.style)).toContain('#F9E27D');
    expect(JSON.stringify(getByTestId('queue-active-indicator-s1').props.style)).toContain('#F9E27D');
    expect(JSON.stringify(getByText('One').props.style)).toContain(mockAppTheme.theme.palette.text.primary);
    expect(JSON.stringify(getByText('Now Playing').props.style)).toContain(mockAppTheme.theme.palette.text.primary);
    expect(JSON.stringify(getByText('One').props.style)).not.toContain('#101820');
    expect(JSON.stringify(getByText('Now Playing').props.style)).not.toContain('#101820');
  });

  test('renders a light empty state inside the list frame', () => {
    const { getByTestId, queryByText } = renderPanel({ queue: [], currentSong: null });

    expect(getByTestId('now-playing-queue-list-frame')).toBeTruthy();
    expect(getByTestId('queue-empty-state')).toBeTruthy();
    expect(queryByText('WARTESCHLANGE')).toBeNull();
  });

  test('keeps a single-track queue visible and active', () => {
    const { getByTestId } = renderPanel({ queue: [queue[0]], currentSong: queue[0] });

    expect(getByTestId('queue-row-s1')).toBeTruthy();
    expect(getByTestId('queue-active-indicator-s1')).toBeTruthy();
  });
});
