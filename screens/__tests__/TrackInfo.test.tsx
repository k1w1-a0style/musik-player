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
    albumArtist: 'Album Artist',
    duration: 245000,
    trackNumber: '3/12',
    discNumber: '1/2',
    comment: 'Kommentar',
    uri: 'file:///music/song.mp3',
    cover: 'file:///cover.jpg',
    fileInfo: {
      filename: 'song.mp3',
      uri: 'file:///music/song.mp3',
      size: 1048576,
      mimeType: 'audio/mpeg',
    },
    audioInfo: {
      codec: 'audio/mpeg',
      durationMs: 245000,
      bitrate: 320,
      bitrateMode: 'vbr' as const,
      sampleRate: 44100,
      channels: 2,
    },
    coverInfo: {
      status: 'cached' as const,
      uri: 'file:///cover.jpg',
      mimeType: 'image/jpeg',
      byteLength: 2048,
      width: 800,
      height: 600,
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
    expect(getByText(/Album-Künstler: Album Artist/)).toBeTruthy();
    expect(getByText(/Dateiname: song.mp3/)).toBeTruthy();
    expect(getByText(/Tracknummer: 3\/12/)).toBeTruthy();
    expect(getByText(/Discnummer: 1\/2/)).toBeTruthy();
    expect(getByText(/Kommentar: Kommentar/)).toBeTruthy();
  });

  test('shows extended audio and cover technical data', () => {
    const { getByText } = render(<TrackInfo />);

    expect(getByText(/Dauer: 4:05/)).toBeTruthy();
    expect(getByText(/Dateigröße: 1.00 MB/)).toBeTruthy();
    expect(getByText(/Codec: audio\/mpeg/)).toBeTruthy();
    expect(getByText(/Bitrate: 320 kbps/)).toBeTruthy();
    expect(getByText(/Bitrate-Modus: VBR/)).toBeTruthy();
    expect(getByText(/Sample Rate: 44.1 kHz/)).toBeTruthy();
    expect(getByText(/Kanäle: 2 Kanäle \(Stereo\)/)).toBeTruthy();
    expect(getByText(/Cover-MIME-Type: image\/jpeg/)).toBeTruthy();
    expect(getByText(/Cover-Dateigröße: 2.00 KB/)).toBeTruthy();
    expect(getByText(/Cover-Abmessungen: 800 × 600 px/)).toBeTruthy();
  });

  test('shows mime type when available', () => {
    const { getByText } = render(<TrackInfo />);

    expect(getByText(/MIME-Type: audio\/mpeg/)).toBeTruthy();
  });

  test('shows not available mime when missing', () => {
    mockRouteSongId = '2';
    const { getByText } = render(<TrackInfo />);

    expect(getByText(/MIME-Type: Nicht verfügbar/)).toBeTruthy();
    expect(getByText(/Bitrate-Modus: Nicht verfügbar/)).toBeTruthy();
    expect(getByText(/Cover-Abmessungen: Nicht verfügbar/)).toBeTruthy();
  });

  test('cover fallback on image error', () => {
    const { UNSAFE_getByType, getByText } = render(<TrackInfo />);

    fireEvent(UNSAFE_getByType(Image), 'error');

    expect(getByText(/Cover-Typ: Gecachtes Cover/)).toBeTruthy();
  });

  test('navigates to tag editor', () => {
    const { getByLabelText, getByText } = render(<TrackInfo />);
    expect(getByText('ID3/M4A Tags bearbeiten')).toBeTruthy();
    fireEvent.press(getByLabelText('Tags bearbeiten'));
    expect(mockNavigate).toHaveBeenCalledWith('TagEditor', { songId: '1' });
  });

  test('shows not found state', () => {
    mockRouteSongId = '404';
    const { getByText } = render(<TrackInfo />);

    expect(getByText('Titel nicht gefunden.')).toBeTruthy();
  });
});
