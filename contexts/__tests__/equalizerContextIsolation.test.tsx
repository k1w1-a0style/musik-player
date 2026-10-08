import React, { memo } from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { MusicContextProviders } from '../MusicContextProviders';
import { useEqualizerMusicContext } from '../musicContexts';
import type { MusicContextValue } from '../musicContextTypes';

test('playlist and volume updates do not wake EQ consumers; band updates do', () => {
  const renders = jest.fn();
  const Consumer = memo(() => {
    const { eqBands } = useEqualizerMusicContext();
    renders();
    return <Text>{eqBands.join(',')}</Text>;
  });
  const value = {
    eqEnabled: true, setEqEnabled: jest.fn(), eqBands: [0, 0], setEqBand: jest.fn(),
    eqPreset: 'flat', applyEqPreset: jest.fn(), eqNative: null,
    volume: 1, playlists: [],
  } as unknown as MusicContextValue;
  const mount = (next: MusicContextValue) => <MusicContextProviders value={next}
    libraryValue={null as never} miniPlayerValue={null as never} nowPlayingValue={null as never}>
    <Consumer />
  </MusicContextProviders>;
  const { rerender, getByText } = render(mount(value));
  expect(renders).toHaveBeenCalledTimes(1);
  rerender(mount({ ...value, volume: 0.5, playlists: [{ id: 'new' }] as never }));
  expect(renders).toHaveBeenCalledTimes(1);
  rerender(mount({ ...value, eqBands: [2, 0] }));
  expect(renders).toHaveBeenCalledTimes(2);
  expect(getByText('2,0')).toBeTruthy();
});
