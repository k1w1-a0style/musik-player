import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import SystemAudio from 'expo-system-audio';
import SongCard from '../SongCard';

describe('SongCard', () => {
  const song = { id: '1', title: 'Track', artist: 'Artist', cover: 'file:///broken.jpg' };

  test('falls back when cover image errors', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(
      <SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />,
    );

    fireEvent(UNSAFE_getByType(Image), 'error');

    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  test('calls stable song press handler with the row song', () => {
    const onPressSong = jest.fn();
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />,
    );

    fireEvent.press(getByTestId('song-card-1'));

    expect(onPressSong).toHaveBeenCalledWith(song);
  });

  test('calls info handler with song', () => {
    const onInfoSong = jest.fn();
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={jest.fn()} onInfoSong={onInfoSong} isCurrent={false} isPlaying={false} />,
    );

    fireEvent.press(getByTestId('song-card-info-1'));

    expect(onInfoSong).toHaveBeenCalledWith(song);
  });

  test('pressing info does not trigger song press', () => {
    const onPressSong = jest.fn();
    const onInfoSong = jest.fn();
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={onPressSong} onInfoSong={onInfoSong} isCurrent={false} isPlaying={false} />,
    );

    fireEvent.press(getByTestId('song-card-info-1'));

    expect(onInfoSong).toHaveBeenCalledWith(song);
    expect(onPressSong).not.toHaveBeenCalled();
  });

  test('marks current song as selected for accessibility', () => {
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={jest.fn()} isCurrent isPlaying={false} />,
    );

    expect(getByTestId('song-card-1').props.accessibilityState?.selected).toBe(true);
  });

  test('does not mark non-current song as selected for accessibility', () => {
    const { getByTestId } = render(
      <SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />,
    );

    expect(getByTestId('song-card-1').props.accessibilityState?.selected).not.toBe(true);
  });

});

jest.mock('expo-system-audio', () => ({
  extractEmbeddedArtwork: jest.fn(),
}));

test('does not trigger native embedded-artwork extraction from rows', () => {
  render(
    <>
      <SongCard song={{ id: 'a', title: 'A', artist: 'Artist', uri: 'file:///a.mp3' }} onPressSong={jest.fn()} isCurrent isPlaying={false} />
      <SongCard song={{ id: 'b', title: 'B', artist: 'Artist', uri: 'file:///b.mp3' }} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />
    </>,
  );

  expect(SystemAudio.extractEmbeddedArtwork).not.toHaveBeenCalled();
});
