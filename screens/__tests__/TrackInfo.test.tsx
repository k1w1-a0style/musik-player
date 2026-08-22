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
    tokens: {
      spacing: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 },
      radii: { input: 10, card: 14, elevatedCard: 20, control: 18 },
      fonts: { display: 'Bricolage-Bold', heading: 'Bricolage-SemiBold', body: 'Bricolage-Regular' },
      typography: {
        display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
        title: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
        sectionTitle: { fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
        body: { fontSize: 14, lineHeight: 20, letterSpacing: 0 },
        caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
      },
    },
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

  test('renders a typographic hero and separated metadata fields', () => {
    const { getByLabelText, getByTestId, getByText } = render(<TrackInfo />);

    expect(getByTestId('track-info-hero')).toBeTruthy();
    expect(getByText('Song')).toBeTruthy();
    expect(getByText('Artist')).toBeTruthy();
    expect(getByText('Album')).toBeTruthy();
    expect(getByLabelText('Album-Künstler: Album Artist')).toBeTruthy();
    expect(getByLabelText('Dateiname: song.mp3')).toBeTruthy();
    expect(getByLabelText('Tracknummer: 3/12')).toBeTruthy();
    expect(getByLabelText('Discnummer: 1/2')).toBeTruthy();
    expect(getByLabelText('Kommentar: Kommentar')).toBeTruthy();
  });

  test('shows extended audio and cover technical data', () => {
    const { getByLabelText } = render(<TrackInfo />);

    expect(getByLabelText('Dauer: 4:05')).toBeTruthy();
    expect(getByLabelText('Dateigröße: 1.00 MB')).toBeTruthy();
    expect(getByLabelText('Codec: audio/mpeg')).toBeTruthy();
    expect(getByLabelText('Bitrate: 320 kbps')).toBeTruthy();
    expect(getByLabelText('Bitrate-Modus: VBR')).toBeTruthy();
    expect(getByLabelText('Sample Rate: 44.1 kHz')).toBeTruthy();
    expect(getByLabelText('Kanäle: 2 Kanäle (Stereo)')).toBeTruthy();
    expect(getByLabelText('Cover-MIME-Type: image/jpeg')).toBeTruthy();
    expect(getByLabelText('Cover-Dateigröße: 2.00 KB')).toBeTruthy();
    expect(getByLabelText('Cover-Abmessungen: 800 × 600 px')).toBeTruthy();
  });

  test('shows mime type when available', () => {
    const { getByLabelText } = render(<TrackInfo />);

    expect(getByLabelText('MIME-Type: audio/mpeg')).toBeTruthy();
  });

  test('shows not available mime when missing', () => {
    mockRouteSongId = '2';
    const { getAllByLabelText, getByLabelText } = render(<TrackInfo />);

    expect(getAllByLabelText(/MIME-Type: Nicht verfügbar/).length).toBe(2);
    expect(getByLabelText('Bitrate-Modus: Nicht verfügbar')).toBeTruthy();
    expect(getByLabelText('Cover-Abmessungen: Nicht verfügbar')).toBeTruthy();
  });

  test('cover fallback on image error', () => {
    const { UNSAFE_getByType, getByLabelText } = render(<TrackInfo />);

    fireEvent(UNSAFE_getByType(Image), 'error');

    expect(getByLabelText('Cover-Typ: Gecachtes Cover')).toBeTruthy();
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
