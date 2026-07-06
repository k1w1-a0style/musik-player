import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import TrackInfo from '../TrackInfo';
const mockAppThemeContextValue = {
  appearance: 'dark',
  skin: 'graphite',
  isHydrated: true,
  setAppearance: jest.fn(),
  setSkin: jest.fn(),
  theme: {
    id: 'graphite-dark',
    appearance: 'dark',
    skin: 'graphite',
    label: 'Graphite Dark',
    navigationDark: true,
    statusBarStyle: 'light-content',
    palette: {
      background: '#08090B',
      backgroundDeep: '#030406',
      surface: '#111318',
      surfaceElevated: '#191B21',
      surfaceGlass: 'rgba(18, 20, 26, 0.76)',
      card: '#111318',
      cardElevated: '#1A1D24',
      border: 'rgba(255, 255, 255, 0.08)',
      borderStrong: 'rgba(210, 218, 230, 0.28)',
      primary: '#D8DEE8',
      primaryDark: '#87909E',
      primaryGlow: 'rgba(216, 222, 232, 0.12)',
      accent: '#BFC7D4',
      accentGlow: 'rgba(191, 199, 212, 0.10)',
      success: '#D8DEE8',
      error: '#FF6F8A',
      warning: '#FFCA77',
      text: {
        primary: '#F4F5F7',
        secondary: 'rgba(244, 245, 247, 0.70)',
        muted: 'rgba(244, 245, 247, 0.42)',
        onPrimary: '#07090C',
      },
    },
    gradients: {
      background: ['#030406', '#08090B', '#0D1014'],
      nowPlaying: ['#030406', '#08090B', '#0D1014'],
    },
  },
};

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => mockAppThemeContextValue,
  useOptionalAppTheme: () => mockAppThemeContextValue,
}));

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
    const { getAllByText, getByText } = render(<TrackInfo />);

    expect(getAllByText(/MIME-Type: Nicht verfügbar/).length).toBe(2);
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
