import React from 'react';
import { render } from '@testing-library/react-native';
import NowPlayingPlayerPanel from '../NowPlayingPlayerPanel';

type MockCoverProps = {
  swipeEnabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

const mockCoverProps: MockCoverProps[] = [];

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
  default: (props: MockCoverProps) => {
    mockCoverProps.push(props);
    return null;
  },
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

const renderPanel = (props: Partial<React.ComponentProps<typeof NowPlayingPlayerPanel>> = {}) => render(
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
    controlsMode={props.controlsMode ?? 'classic'}
    onSwipeToNext={props.onSwipeToNext ?? jest.fn()}
    onSwipeToPrevious={props.onSwipeToPrevious ?? jest.fn()}
  />,
);

describe('NowPlayingPlayerPanel', () => {
  beforeEach(() => {
    mockCoverProps.length = 0;
  });

  test('renders as a fixed classic panel so the outer snap pager owns vertical scrolling', () => {
    const { getByTestId } = renderPanel();
    const playerPanel = getByTestId('now-playing-player-panel');

    expect(playerPanel.props.nestedScrollEnabled).toBeUndefined();
    expect(playerPanel.props.bounces).toBeUndefined();
    expect(playerPanel.props.showsVerticalScrollIndicator).toBeUndefined();
  });

  test('renders bottom controls without a nested content container', () => {
    const { getByTestId } = renderPanel();
    const playerPanel = getByTestId('now-playing-player-panel');

    expect(playerPanel.props.contentContainerStyle).toBeUndefined();
    expect(getByTestId('now-playing-volume-wrap')).toBeTruthy();
  });

  test('keeps cover swipe disabled in the classic player layout', () => {
    renderPanel({ controlsMode: 'classic' });

    expect(mockCoverProps[0].swipeEnabled).toBe(false);
  });

  test('does not enable cover swipe in the placeholder SoundCloud layout yet', () => {
    renderPanel({ controlsMode: 'soundcloud' });

    expect(mockCoverProps[0].swipeEnabled).toBeFalsy();
  });
});
