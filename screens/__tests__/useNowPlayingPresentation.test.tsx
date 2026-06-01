import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useNowPlayingPresentation } from '../useNowPlayingPresentation';
import type { Song } from '../../types/Song';
import { theme } from '../../theme';

const song: Song = {
  id: 's1',
  title: 'One',
  artist: 'A',
  album: 'Album',
  cover: 'file:///cover.jpg',
};

const PresentationProbe = () => {
  const presentation = useNowPlayingPresentation({
    currentSong: song,
    palette: {
      dominant: '#111111',
      vibrant: '#222222',
      darkVibrant: '#333333',
      lightVibrant: '#444444',
    },
  });

  return (
    <>
      <Text testID="accent">{presentation.accent}</Text>
      <Text testID="accent-dark">{presentation.accentDark}</Text>
      <Text testID="album-title">{presentation.albumTitle}</Text>
      <Text testID="artwork-uri">{presentation.artworkUri}</Text>
      <Text testID="gradient-count">{presentation.gradientColors.length}</Text>
      <Text testID="progress-accent">{presentation.progressAccent}</Text>
      <Text testID="progress-accent-dark">{presentation.progressAccentDark}</Text>
    </>
  );
};

describe('useNowPlayingPresentation', () => {
  test('builds presentation values from current song and palette', () => {
    const { getByTestId } = render(<PresentationProbe />);

    expect(getByTestId('accent').props.children).toBe('#222222');
    expect(getByTestId('accent-dark').props.children).toBe('#333333');
    expect(getByTestId('album-title').props.children).toBe('Album');
    expect(getByTestId('artwork-uri').props.children).toBe('file:///cover.jpg');
    expect(getByTestId('gradient-count').props.children).toBe(
      theme.gradients.nowPlayingBackdrop('#222222', '#333333').length,
    );
    expect(getByTestId('progress-accent').props.children).toBe('#222222');
    expect(getByTestId('progress-accent-dark').props.children).toBe('#444444');
  });
});
