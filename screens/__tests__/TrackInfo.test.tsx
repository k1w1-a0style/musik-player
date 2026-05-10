import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import TrackInfo from '../TrackInfo';

let mockRouteSongId = '1';
const mockNavigate = jest.fn();

const mockSongs = [
  {
    id: '1',
    title: 'Song',
    artist: 'Artist',
    album: 'Album',
    duration: 245000,
    uri: 'file:///music/song.mp3',
    cover: 'file:///cover.jpg',
    fileInfo: {
      filename: 'song.mp3',
      uri: 'file:///music/song.mp3',
      size: 1048576,
      mimeType: 'audio/mpeg',
    },
    audioInfo: {},
    coverInfo: {
      status: 'cached',
      uri: 'file:///cover.jpg',
    },
  },
  {
    id: '2',
    title: 'NoMime',
    artist: 'Artist',
    uri: 'file:///music/nomime.xyz',
    fileInfo: { filename: 'nomime.xyz' },
  },
];

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { songId: mockRouteSongId } }),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('../../contexts/MusicContext', () => ({
  useLibraryMusicContext: () => ({ songs: mockSongs }),
}));

jest.mock('../../components/AppBackground', () => ({
  children,
}: {
  children: React.ReactNode;
}) => <>{children}</>);

jest.mock('../../components/Screen', () => ({
  children,
}: {
  children: React.ReactNode;
}) => <>{children}</>);

describe('TrackInfo', () => {
  beforeEach(() => {
    mockRouteSongId = '1';
    mockNavigate.mockReset();
  });

  test('renders title artist album and file fields', () => {
    const { getByText } = render(<TrackInfo />);

    expect(getByText(/Titel: Song/)).toBeTruthy();
    expect(getByText(/Dateiname: song.mp3/)).toBeTruthy();
  });

  test('shows non-available for missing technical data and formats values', () => {
    const { getByText } = render(<TrackInfo />);

    expect(getByText(/Dauer: 4:05/)).toBeTruthy();
    expect(getByText(/Dateigröße: 1.00 MB/)).toBeTruthy();
    expect(getByText(/Codec: Nicht verfügbar/)).toBeTruthy();
  });

  test('shows mime type when available', () => {
    const { getByText } = render(<TrackInfo />);

    expect(getByText(/MIME-Type: audio\/mpeg/)).toBeTruthy();
  });

  test('shows not available mime when missing', () => {
    mockRouteSongId = '2';
    const { getByText } = render(<TrackInfo />);

    expect(getByText(/MIME-Type: Nicht verfügbar/)).toBeTruthy();
  });

  test('cover fallback on image error', () => {
    const { UNSAFE_getByType, getByText } = render(<TrackInfo />);

    fireEvent(UNSAFE_getByType(Image), 'error');

    expect(getByText(/Cover-Typ: Gecachtes Cover/)).toBeTruthy();
  });


  test('navigates to tag editor', () => {
    const { getByText } = render(<TrackInfo />);
    fireEvent.press(getByText('Bearbeiten'));
    expect(mockNavigate).toHaveBeenCalledWith('TagEditor', { songId: '1' });
  });

  test('shows not found state', () => {
    mockRouteSongId = '404';
    const { getByText } = render(<TrackInfo />);

    expect(getByText('Song nicht gefunden.')).toBeTruthy();
  });
});
