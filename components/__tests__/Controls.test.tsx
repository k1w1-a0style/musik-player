import React from 'react';
import { render } from '@testing-library/react-native';
import Controls from '../Controls';

const mockUseMusicContext = jest.fn();

const mockAppTheme = {
  palette: {
    surfaceGlass: 'rgba(18, 20, 26, 0.76)',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#D8DEE8',
    primaryDark: '#87909E',
    text: {
      primary: '#F4F5F7',
      muted: 'rgba(244, 245, 247, 0.42)',
      onPrimary: '#07090C',
    },
  },
};

jest.mock('../../contexts/MusicContext', () => ({
  useMusicContext: () => mockUseMusicContext(),
}));

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

const song = {
  id: 's1',
  title: 'Song 1',
  artist: 'Artist',
  uri: 'mock-song-1.mp3',
};

const song2 = {
  id: 's2',
  title: 'Song 2',
  artist: 'Artist',
  uri: 'mock-song-2.mp3',
};

const makeCtx = (overrides = {}) => ({
  isPlaying: false,
  isBuffering: false,
  togglePlayPause: jest.fn(async () => undefined),
  next: jest.fn(async () => undefined),
  previous: jest.fn(async () => undefined),
  currentSong: song,
  playbackQueue: [song],
  shuffle: false,
  toggleShuffle: jest.fn(async () => undefined),
  repeatMode: 'off',
  cycleRepeatMode: jest.fn(async () => undefined),
  ...overrides,
});

describe('Controls', () => {
  beforeEach(() => {
    mockUseMusicContext.mockReset();
    mockUseMusicContext.mockReturnValue(makeCtx());
  });

  test('allows previous to restart the current song in a single-track queue', () => {
    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-previous').props.accessibilityState?.disabled).toBe(false);
    expect(getByTestId('controls-next').props.accessibilityState?.disabled).toBe(true);
  });

  test('disables next at the stable queue end when repeat all is off', () => {
    mockUseMusicContext.mockReturnValue(makeCtx({ currentSong: song2, playbackQueue: [song, song2] }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-next').props.accessibilityState?.disabled).toBe(true);
  });

  test('allows next at the stable queue end when repeat all is enabled', () => {
    mockUseMusicContext.mockReturnValue(makeCtx({ currentSong: song2, playbackQueue: [song, song2], repeatMode: 'all' }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-next').props.accessibilityState?.disabled).toBe(false);
  });

  test('allows next before the stable queue end', () => {
    mockUseMusicContext.mockReturnValue(makeCtx({ currentSong: song, playbackQueue: [song, song2] }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-next').props.accessibilityState?.disabled).toBe(false);
  });

  test('disables previous and next without a current song', () => {
    mockUseMusicContext.mockReturnValue(makeCtx({ currentSong: null, playbackQueue: [] }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-previous').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('controls-next').props.accessibilityState?.disabled).toBe(true);
  });

  test.each([
    [true, 'Pausieren'],
    [false, 'Abspielen'],
  ])('play-pause button label is correct when isPlaying is %s', (isPlaying, expectedLabel) => {
    mockUseMusicContext.mockReturnValue(makeCtx({ isPlaying }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-play-pause').props.accessibilityLabel).toBe(expectedLabel);
  });

  test.each([
    [true, 'Zufallswiedergabe aus'],
    [false, 'Zufallswiedergabe an'],
  ])('shuffle button uses correct label when shuffle is %s', (shuffle, expectedLabel) => {
    mockUseMusicContext.mockReturnValue(makeCtx({ shuffle }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-shuffle').props.accessibilityLabel).toBe(expectedLabel);
  });

  test.each([
    ['off', 'Wiederholung aus'],
    ['one', 'Titel wiederholen'],
    ['all', 'Alle Titel wiederholen'],
  ])('uses localized repeat accessibility label for %s mode', (repeatMode, expectedLabel) => {
    mockUseMusicContext.mockReturnValue(makeCtx({ repeatMode }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-repeat').props.accessibilityLabel).toBe(expectedLabel);
  });

  test('renders all control buttons with labels and hit slop', () => {
    const { getByTestId } = render(<Controls />);

    [
      ['controls-shuffle', 'Zufallswiedergabe an'],
      ['controls-previous', 'Vorheriger Titel'],
      ['controls-play-pause', 'Abspielen'],
      ['controls-next', 'Nächster Titel'],
      ['controls-repeat', 'Wiederholung aus'],
    ].forEach(([testID, label]) => {
      const button = getByTestId(testID);
      expect(button.props.accessibilityRole).toBe('button');
      expect(button.props.accessibilityLabel).toBe(label);
      expect(button.props.hitSlop).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
    });
  });

  test('disabled states remain exposed for unavailable actions', () => {
    mockUseMusicContext.mockReturnValue(makeCtx({ currentSong: null, playbackQueue: [], isBuffering: true }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-previous').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('controls-next').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('controls-play-pause').props.accessibilityState?.disabled).toBe(true);
  });

  test('uses app theme chrome when accent props are omitted', () => {
    const { getByTestId } = render(<Controls />);

    const previousStyle = JSON.stringify(getByTestId('controls-previous').props.style);
    const playStyle = JSON.stringify(getByTestId('controls-play-pause').props.style);

    expect(previousStyle).toContain(mockAppTheme.palette.surfaceGlass);
    expect(previousStyle).toContain(mockAppTheme.palette.border);
    expect(playStyle).toContain(mockAppTheme.palette.primary);
    expect(playStyle).toContain(mockAppTheme.palette.primaryDark);
  });
});
