import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MiniPlayer from '../MiniPlayer';

const mockUseMiniPlayerMusicContext = jest.fn(() => ({
  currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
  isPlaying: false,
  togglePlayPause: jest.fn(async () => undefined),
  next: jest.fn(async () => undefined),
  canSkipNext: true,
}));

jest.mock('../../contexts/MusicContext', () => ({
  useMiniPlayerMusicContext: () => mockUseMiniPlayerMusicContext(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

describe('MiniPlayer cover fallback', () => {
  beforeEach(() => {
    mockUseMiniPlayerMusicContext.mockReset();
    mockUseMiniPlayerMusicContext.mockReturnValue({
      currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
      isPlaying: false,
      togglePlayPause: jest.fn(async () => undefined),
      next: jest.fn(async () => undefined),
      canSkipNext: true,
    });
  });

  test('falls back when cover image errors', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<MiniPlayer onOpen={jest.fn()} />);
    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  test('disables next button when queue cannot skip', () => {
    mockUseMiniPlayerMusicContext.mockReturnValue({
      currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: '' },
      isPlaying: true,
      togglePlayPause: jest.fn(async () => undefined),
      next: jest.fn(async () => undefined),
      canSkipNext: false,
    });
    const { getByTestId } = render(<MiniPlayer onOpen={jest.fn()} />);
    expect(getByTestId('mini-player-next').props.accessibilityState?.disabled).toBe(true);
  });
});
