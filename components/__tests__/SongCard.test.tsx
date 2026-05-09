import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import SongCard from '../SongCard';

describe('SongCard', () => {
  const song = { id: '1', title: 'Track', artist: 'Artist', cover: 'file:///broken.jpg' };

  test('falls back when cover image errors', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(<SongCard song={song} onPressSong={jest.fn()} isCurrent={false} isPlaying={false} />);
    fireEvent(UNSAFE_getByType(Image), 'error');
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });

  test('calls stable song press handler with the row song', () => {
    const onPressSong = jest.fn();
    const { getByTestId } = render(<SongCard song={song} onPressSong={onPressSong} isCurrent={false} isPlaying={false} />);
    fireEvent.press(getByTestId('song-card-1'));
    expect(onPressSong).toHaveBeenCalledWith(song);
  });

  test('calls info handler with song', () => {
    const onInfoSong = jest.fn();
    const { getByTestId } = render(<SongCard song={song} onPressSong={jest.fn()} onInfoSong={onInfoSong} isCurrent={false} isPlaying={false} />);
    fireEvent.press(getByTestId('song-card-info-1'));
    expect(onInfoSong).toHaveBeenCalledWith(song);
  });
});
