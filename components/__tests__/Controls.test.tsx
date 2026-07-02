import React from 'react';
import { render } from '@testing-library/react-native';
import Controls from '../Controls';

const mockUseMusicContext = jest.fn();

jest.mock('../../contexts/MusicContext', () => ({
  useMusicContext: () => mockUseMusicContext(),
}));

const song = {
  id: 's1',
  title: 'Song 1',
  artist: 'Artist',
  uri: 'mock-song-1.mp3',
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

});
