import React from 'react';
import { render } from '@testing-library/react-native';
import NowPlayingPlayerPanel from '../NowPlayingPlayerPanel';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
    theme: {
      palette: {
        background: '#07090C',
        surface: '#101218',
        surfaceElevated: '#191B21',
        surfaceGlass: 'rgba(18, 20, 26, 0.76)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderStrong: 'rgba(210, 218, 230, 0.28)',
        primary: '#D8DEE8',
        primaryDark: '#87909E',
        primaryGlow: 'rgba(216, 222, 232, 0.12)',
        error: '#FF6F8A',
        text: {
          primary: '#F4F5F7',
          secondary: 'rgba(244, 245, 247, 0.70)',
          muted: 'rgba(244, 245, 247, 0.42)',
          onPrimary: '#07090C',
        },
      },
      gradients: {
        background: ['#07090C', '#101218'],
        nowPlaying: ['#07090C', '#191B21'],
      },
    },
  }),
}));

jest.mock('../NowPlayingCoverArtwork', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../NowPlayingTitleRow', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../NowPlayingPlaybackSection', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('lucide-react-native', () => ({
  Disc3: 'Disc3',
  Volume2: 'Volume2',
  VolumeX: 'VolumeX',
}));

const renderPanel = () => render(
  <NowPlayingPlayerPanel
    currentSong={null}
    isPlaying={false}
    accent="#123456"
    coverAreaHeight={168}
    coverSize={156}
    favorite={false}
    favoritePending={false}
    onToggleFavorite={jest.fn()}
    position={0}
    duration={0}
    onSeek={jest.fn(async () => undefined)}
    progressAccent="#abcdef"
    progressAccentDark="#012345"
    foregroundOnAccent="#ffffff"
    volume={0.5}
    onVolumeChange={jest.fn(async () => undefined)}
    bottomInset={0}
    onOpenTrackInfo={jest.fn()}
  />,
);

describe('NowPlayingPlayerPanel', () => {
  test('renders the player ScrollView with Android nested scrolling enabled', () => {
    const { getByTestId } = renderPanel();
    const playerPanel = getByTestId('now-playing-player-panel');

    expect(playerPanel.props.nestedScrollEnabled).toBe(true);
    expect(playerPanel.props.bounces).toBe(false);
    expect(playerPanel.props.showsVerticalScrollIndicator).toBe(false);
  });

  test('keeps content container style and renders bottom controls', () => {
    const { getByTestId } = renderPanel();
    const playerPanel = getByTestId('now-playing-player-panel');

    expect(playerPanel.props.contentContainerStyle).toBeTruthy();
    expect(getByTestId('now-playing-volume-wrap')).toBeTruthy();
  });
});
