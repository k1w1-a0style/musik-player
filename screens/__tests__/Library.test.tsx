import React from 'react';
import { Image, Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import Library from '../Library';

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({
    songs: [],
    setSongs: jest.fn(),
    currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
    playSong: jest.fn(async () => undefined),
    isReady: true,
    isPlaying: false,
  }),
}));

jest.mock('../../components/AppBackground', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

jest.mock('../../components/Screen', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

jest.mock('../../components/SongCard', () => {
  return () => null;
});

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
}));

describe('Library preview cover fallback', () => {
  test('hides broken preview image after error', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<Library />);
    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });
});
