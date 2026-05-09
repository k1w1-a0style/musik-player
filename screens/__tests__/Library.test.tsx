import React from 'react';
import { Image, Pressable, Text } from 'react-native';
const mockPressable = Pressable;
const mockText = Text;
import { fireEvent, render } from '@testing-library/react-native';
import Library from '../Library';

const mockPlaySong = jest.fn(async () => undefined);
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({
    songs: [{ id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' }],
    setSongs: jest.fn(),
    currentSong: { id: 's1', title: 'Song', artist: 'Artist', cover: 'file:///broken.jpg' },
    playSong: mockPlaySong,
    isReady: true,
    isPlaying: false,
  }),
}));

jest.mock('../../components/AppBackground', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: { children: React.ReactNode }) => <>{children}</>);

jest.mock('../../components/SongCard', () => ({ song, onInfoSong }: any) => <mockPressable testID={`info-${song.id}`} onPress={() => onInfoSong(song)}><mockText>info</mockText></mockPressable>);

jest.mock('expo-media-library', () => ({ requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })) }));

describe('Library preview cover fallback', () => {
  test('hides broken preview image after error', () => { const { UNSAFE_getByType, UNSAFE_queryByType } = render(<Library />); fireEvent(UNSAFE_getByType(Image), 'error'); expect(UNSAFE_queryByType(Image)).toBeNull(); });
  test('opens track info without starting playback', () => { const { getByTestId } = render(<Library />); fireEvent.press(getByTestId('info-s1')); expect(mockNavigate).toHaveBeenCalledWith('TrackInfo', { songId: 's1' }); expect(mockPlaySong).not.toHaveBeenCalled(); });
});
