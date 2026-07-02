import React from 'react';
import { render } from '@testing-library/react-native';
import NowPlayingBottomControlsRow from '../NowPlayingBottomControlsRow';

jest.mock('lucide-react-native', () => ({
  Disc3: 'Disc3',
  Volume2: 'Volume2',
  VolumeX: 'VolumeX',
}));

describe('NowPlayingBottomControlsRow', () => {
  test('renders the volume area inline without a heavy glass card', () => {
    const { getByTestId, queryByTestId } = render(
      <NowPlayingBottomControlsRow
        volume={0.5}
        onVolumeChange={jest.fn(async () => undefined)}
        bottomInset={24}
        onOpenTrackInfo={jest.fn()}
        accentColor="#00ffaa"
      />,
    );

    expect(queryByTestId('glass-card')).toBeNull();
    expect(getByTestId('now-playing-volume-wrap')).toBeTruthy();
    expect(getByTestId('volume-slider')).toBeTruthy();
  });

  test('keeps bottom inset padding bounded inside the available row', () => {
    const { UNSAFE_root } = render(
      <NowPlayingBottomControlsRow
        volume={0.5}
        onVolumeChange={jest.fn(async () => undefined)}
        bottomInset={20}
        onOpenTrackInfo={jest.fn()}
        accentColor="#00ffaa"
      />,
    );

    expect(UNSAFE_root.children[0].props.style).toEqual(expect.arrayContaining([
      expect.objectContaining({ marginTop: 'auto' }),
      { paddingBottom: 32 },
    ]));
  });
});
