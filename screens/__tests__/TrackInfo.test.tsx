import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import TrackInfo from '../TrackInfo';

let mockRouteSongId = '1';
const mockSongs = [{ id: '1', title: 'Song', artist: 'Artist', album: 'Album', duration: 245000, uri: 'file:///music/song.mp3', cover: 'file:///cover.jpg', fileInfo: { filename: 'song.mp3', uri: 'file:///music/song.mp3', size: 1048576 }, audioInfo: {}, coverInfo: { status: 'cached', uri: 'file:///cover.jpg' } }];

jest.mock('@react-navigation/native', () => ({ useRoute: () => ({ params: { songId: mockRouteSongId } }) }));
jest.mock('../../contexts/MusicContext', () => ({ useLibraryMusicContext: () => ({ songs: mockSongs }) }));
jest.mock('../../components/AppBackground', () => ({ children }: any) => <>{children}</>);
jest.mock('../../components/Screen', () => ({ children }: any) => <>{children}</>);

describe('TrackInfo', () => {
  beforeEach(() => { mockRouteSongId = '1'; });
  test('renders title artist album and file fields', () => { const { getByText } = render(<TrackInfo />); expect(getByText(/Titel: Song/)).toBeTruthy(); expect(getByText(/Dateiname: song.mp3/)).toBeTruthy(); });
  test('shows non-available for missing technical data and formats values', () => { const { getByText } = render(<TrackInfo />); expect(getByText(/Dauer: 4:05/)).toBeTruthy(); expect(getByText(/Dateigröße: 1.00 MB/)).toBeTruthy(); expect(getByText(/Codec: Nicht verfügbar/)).toBeTruthy(); });
  test('cover fallback on image error', () => { const { UNSAFE_getByType, getByText } = render(<TrackInfo />); fireEvent(UNSAFE_getByType(Image), 'error'); expect(getByText(/Cover-Typ: cached/)).toBeTruthy(); });
  test('shows not found state', () => { mockRouteSongId = '404'; const { getByText } = render(<TrackInfo />); expect(getByText('Song nicht gefunden.')).toBeTruthy(); });
});
