import React from 'react';
import { render } from '@testing-library/react-native';
import NowPlayingPlayerPanel from '../NowPlayingPlayerPanel';

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
