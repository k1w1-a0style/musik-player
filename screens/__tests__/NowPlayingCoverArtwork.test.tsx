import React from 'react';
import { render } from '@testing-library/react-native';
import NowPlayingCoverArtwork from '../NowPlayingCoverArtwork';

jest.mock('../../contexts/AppThemeContext', () => ({
  useAppTheme: () => ({
    appearance: 'dark',
    skin: 'graphite',
    isHydrated: true,
    setAppearance: jest.fn(),
    setSkin: jest.fn(),
    theme: {
      palette: {
        surface: '#101218',
        primary: '#D8DEE8',
      },
    },
  }),
}));

jest.mock('lucide-react-native', () => ({
  Disc3: 'Disc3',
}));

const song = { id: 's1', title: 'One', artist: 'Artist' };

describe('NowPlayingCoverArtwork', () => {
  test('renders cover card without swipe handlers by default', () => {
    const { getByTestId } = render(
      <NowPlayingCoverArtwork
        song={song}
        isPlaying={false}
        accent="#123456"
        coverSize={160}
      />,
    );

    const card = getByTestId('now-playing-cover-card');
    expect(card.props.onMoveShouldSetResponder).toBeUndefined();
    expect(getByTestId('now-playing-cover-fallback')).toBeTruthy();
  });

  test('attaches horizontal swipe handlers when enabled', () => {
    const { getByTestId } = render(
      <NowPlayingCoverArtwork
        song={song}
        artworkUri="file:///cover.jpg"
        isPlaying
        accent="#123456"
        coverSize={160}
        swipeEnabled
        onSwipeLeft={jest.fn()}
        onSwipeRight={jest.fn()}
      />,
    );

    const card = getByTestId('now-playing-cover-card');
    expect(card.props.onMoveShouldSetResponder).toEqual(expect.any(Function));
    expect(getByTestId('now-playing-cover-image')).toBeTruthy();
  });
});
