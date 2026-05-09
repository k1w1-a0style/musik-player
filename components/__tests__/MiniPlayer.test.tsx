import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import MiniPlayer from '../MiniPlayer';

jest.mock('../../contexts/MusicContext', () => ({
  useMusicContext: () => ({
    currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
    isPlaying: false,
    togglePlayPause: jest.fn(async () => undefined),
    next: jest.fn(async () => undefined),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

describe('MiniPlayer cover fallback', () => {
  test('falls back when cover image errors', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<MiniPlayer onOpen={jest.fn()} />);
    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });
});

