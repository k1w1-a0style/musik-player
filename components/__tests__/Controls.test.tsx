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
    ['off', 'Wiederholung aus'],
    ['one', 'Song wiederholen'],
    ['all', 'Alle Titel wiederholen'],
  ])('uses localized repeat accessibility label for %s mode', (repeatMode, expectedLabel) => {
    mockUseMusicContext.mockReturnValue(makeCtx({ repeatMode }));

    const { getByTestId } = render(<Controls />);

    expect(getByTestId('controls-repeat').props.accessibilityLabel).toBe(expectedLabel);
  });

});
