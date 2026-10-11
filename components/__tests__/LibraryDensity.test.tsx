import React from 'react';
import * as Native from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import SongCard from '../SongCard';
import LibraryGroupRow from '../LibraryGroupRow';
import { PlayerPresentationProvider } from '../../contexts/PlayerPresentationContext';
import { storage } from '../../utils/storage';
import { getLibraryGroupRowHeight, getLibrarySongItemLayout, getSongCardHeight } from '../../utils/libraryRendererHelpers';
import { getAppTheme } from '../../utils/appTheme';
import type { LibraryDensity } from '../../utils/playerPresentation';

const mockTheme = getAppTheme('dark', 'graphite');
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: mockTheme }) }));
jest.mock('../../utils/storage', () => ({ storage: { get: jest.fn(), set: jest.fn().mockResolvedValue(true) } }));
afterEach(() => jest.restoreAllMocks());

test.each([1, 1.3, 2])('actual row heights and list offsets agree at font scale %s in both densities', async fontScale => {
  // Spy on the actual RN export, not Babel's copied wildcard namespace.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jest.spyOn(require('react-native') as typeof Native, 'useWindowDimensions')
    .mockReturnValue({ width: 320, height: 640, scale: 1, fontScale });
  const song = { id: 'long', title: 'Ein sehr langer deutscher Titel für die schmale Bibliothek', artist: 'Ein ausführlicher Künstlername', duration: 123_000 };
  for (const density of ['standard', 'compact'] as LibraryDensity[]) {
    (storage.get as jest.Mock).mockResolvedValue({ density, quiet: false, waveformAccent: 'cover' });
    const screen = render(<PlayerPresentationProvider>
      <SongCard song={song} isCurrent={false} isPlaying={false} onPressSong={jest.fn()} onInfoSong={jest.fn()} />
      <LibraryGroupRow group={{ id: 'g', title: song.title, subtitle: '2 Titel', songs: [song] }} onPress={jest.fn()} />
    </PlayerPresentationProvider>);
    await waitFor(() => expect(Native.StyleSheet.flatten(screen.getByTestId('song-card-slot-long').props.style).height)
      .toBe(getSongCardHeight(fontScale, false, density)));
    const rowHeight = Native.StyleSheet.flatten(screen.getByTestId('song-card-slot-long').props.style).height;
    expect(getLibrarySongItemLayout(null, 8, fontScale, density)).toEqual({ length: Number(rowHeight) + 6,
      offset: (Number(rowHeight) + 6) * 8, index: 8 });
    expect(Native.StyleSheet.flatten(screen.getByTestId('library-group-row-g').props.style).height)
      .toBe(getLibraryGroupRowHeight(fontScale, density));
    expect(Number(rowHeight)).toBeGreaterThanOrEqual(51 * fontScale + (density === 'compact' ? 12 : 18));
    const menu = screen.getByTestId('song-card-info-long');
    expect(Native.StyleSheet.flatten(menu.props.style)).toMatchObject({ width: 48, height: 48 });
    let ancestor = menu.parent;
    while (ancestor) {
      expect(ancestor.props.testID).not.toBe('song-card-long');
      ancestor = ancestor.parent;
    }
    expect(screen.getByTestId('song-card-long').props.accessibilityLabel).toContain(song.title);
    screen.unmount();
  }
});

test.each(['tile', 'banner'] as const)('menu remains a separate accessible control for %s cards', variant => {
  const screen = render(<SongCard song={{ id: 's', title: 'Title', artist: 'Artist' }} isCurrent={false}
    isPlaying={false} variant={variant} onPressSong={jest.fn()} onInfoSong={jest.fn()} />);
  let ancestor = screen.getByTestId('song-card-info-s').parent;
  while (ancestor) { expect(ancestor.props.testID).not.toBe('song-card-s'); ancestor = ancestor.parent; }
});
