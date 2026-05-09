import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import SongCard from '../SongCard';

describe('SongCard cover fallback', () => {
  test('falls back when cover image errors', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(
      <SongCard
        song={{ id: '1', title: 'Track', artist: 'Artist', cover: 'file:///broken.jpg' }}
        onPressSong={jest.fn()}
        isCurrent={false}
        isPlaying={false}
      />,
    );

    const img = UNSAFE_getByType(Image);
    fireEvent(img, 'error');

    expect(UNSAFE_queryByType(Image)).toBeNull();
  });
});

