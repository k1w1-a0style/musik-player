import React, { memo } from 'react';
import { Alert, Text, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { LibrarySelectionProvider, useLibrarySelection, useLibrarySongSelection } from '../../contexts/LibrarySelectionContext';
import LibrarySelectionActions from '../LibrarySelectionActions';
import SongCard from '../SongCard';
import LibraryGroupRow from '../LibraryGroupRow';
import LibraryFolderRow from '../LibraryFolderRow';
import LibraryMenuModal from '../LibraryMenuModal';
import type { Song } from '../../types/Song';
jest.mock('../../hooks/useArtworkThumbnail', () => ({ useArtworkThumbnail: (uri?: string) => uri }));
jest.mock('../../hooks/useSongPreparation', () => ({ useSongPreparation: () => 'ready' }));
jest.mock('../../contexts/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { palette: {
  surface: '#111', surfaceElevated: '#222', surfaceGlass: '#333', background: '#000', border: '#444', borderStrong: '#555', primary: '#0ff', primaryGlow: '#055',
  text: { primary: '#fff', secondary: '#ddd', muted: '#aaa', onPrimary: '#000' },
} } }) }));
const a: Song = { id: 'a', title: 'Alpha', artist: 'Artist', uri: 'file:///a.mp3' };
const b: Song = { id: 'b', title: 'Beta', artist: 'Artist', uri: 'file:///b.mp3' };

test('long press selects, ordinary taps become checkboxes and info keeps its original editor action', () => {
  const play = jest.fn(); const info = jest.fn(); const open = jest.fn();
  const screen = render(<LibrarySelectionProvider songs={[a,b]} visibleSongs={[a,b]} onOpenCleaner={open}>
    <LibrarySelectionActions /><SongCard song={a} isCurrent={false} isPlaying={false} onPressSong={play} onInfoSong={info} />
    <SongCard song={b} isCurrent={false} isPlaying={false} onPressSong={play} />
  </LibrarySelectionProvider>);
  fireEvent.press(screen.getByTestId('song-card-a')); expect(play).toHaveBeenCalledTimes(1);
  fireEvent(screen.getByTestId('song-card-a'), 'longPress');
  expect(screen.getByTestId('song-card-a').props.accessibilityState.checked).toBe(true);
  expect(screen.getByTestId('song-card-b').props.accessibilityRole).toBe('checkbox');
  fireEvent.press(screen.getByTestId('song-card-b')); expect(play).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId('song-card-info-a')); expect(info).toHaveBeenCalledWith(a);
  fireEvent.press(screen.getByText('Tags bereinigen')); expect(open).toHaveBeenCalledWith(['a','b']);
  fireEvent.press(screen.getByText('Auswahl aufheben')); expect(screen.getByText('0 ausgewählt · 2 auf dieser Liste')).toBeTruthy();
  fireEvent.press(screen.getByText('Auswahl beenden')); fireEvent.press(screen.getByTestId('song-card-a'));
  expect(play).toHaveBeenCalledTimes(2);
});

test('50 memoized row subscribers rerender only the toggled row after entering selection mode', () => {
  const songs = Array.from({ length: 50 }, (_,i) => ({ ...a, id: String(i), uri: `file:///${i}.mp3` }));
  const renders = new Map<string,number>(); const noop = jest.fn();
  let selection: ReturnType<typeof useLibrarySelection>;
  const Capture = () => { selection = useLibrarySelection(); return null; };
  const Row = memo(({ song }: { song: Song }) => {
    const state = useLibrarySongSelection(song, noop).state;
    renders.set(song.id, (renders.get(song.id) ?? 0) + 1); return <Text>{song.id}:{state}</Text>;
  });
  render(<LibrarySelectionProvider songs={songs} visibleSongs={songs} onOpenCleaner={noop}>
    <Capture /><View>{songs.map(song => <Row key={song.id} song={song} />)}</View>
  </LibrarySelectionProvider>);
  act(() => selection!.store.start(songs[0])); renders.clear();
  act(() => selection!.store.toggle(songs[31]));
  expect([...renders.entries()]).toEqual([['31',1]]);
});

test('selection persists across a filtered tab and uses all-visible scope without selecting hidden songs', () => {
  const open = jest.fn(); let selection: ReturnType<typeof useLibrarySelection>;
  const Capture = () => { selection = useLibrarySelection(); return <LibrarySelectionActions />; };
  const view = (visible: Song[]) => <LibrarySelectionProvider songs={[a,b]} visibleSongs={visible} onOpenCleaner={open}><Capture /></LibrarySelectionProvider>;
  const screen = render(view([a])); act(() => selection!.store.start(a)); screen.rerender(view([b]));
  expect(screen.getByText('1 ausgewählt · 1 auf dieser Liste')).toBeTruthy();
  fireEvent.press(screen.getByText('Alle auf dieser Liste auswählen')); fireEvent.press(screen.getByText('Tags bereinigen'));
  expect(open).toHaveBeenCalledWith(['a','b']);
});


test('album menu deduplicates physical sources and leaves collection membership unchanged', () => {
  const open = jest.fn(); const alias = { ...a, id: 'alias' }; const groupSongs = [a, alias, b];
  const alert = jest.spyOn(Alert, 'alert');
  const screen = render(<LibrarySelectionProvider songs={groupSongs} visibleSongs={groupSongs} onOpenCleaner={open}>
    <LibraryGroupRow group={{ id: 'album', title: 'Album', subtitle: '3 titles', songs: groupSongs }} onPress={jest.fn()} />
  </LibrarySelectionProvider>);
  fireEvent(screen.getByTestId('library-group-row-album'), 'longPress');
  expect(alert).toHaveBeenCalledWith('Album', '2 enthaltene Titel, jede Datei einmal.', expect.any(Array));
  const buttons = alert.mock.calls.at(-1)![2]!;
  act(() => buttons.find(button => button.text === 'Tags bereinigen')!.onPress!());
  expect(open).toHaveBeenCalledWith(['a','b']); expect(groupSongs).toEqual([a,alias,b]);
  alert.mockRestore();
});


test('folder action counts proven members and warns about opaque sources without including them', () => {
  const inside = { ...a, uri: 'file:///Music/a.mp3' }; const opaque = { ...b, uri: 'content://media/external/audio/media/12' };
  const open = jest.fn(); const alert = jest.spyOn(Alert, 'alert');
  const folder = { id: 'folder', name: 'Music', uri: 'file:///Music', enabled: true, addedAt: 1 };
  const screen = render(<LibrarySelectionProvider songs={[inside,opaque]} visibleSongs={[inside,opaque]} onOpenCleaner={open}>
    <LibraryFolderRow folder={folder} onRemove={jest.fn()} />
  </LibrarySelectionProvider>);
  fireEvent.press(screen.getByTestId('clean-folder-folder'));
  expect(alert.mock.calls.at(-1)![1]).toContain('1 enthaltene Titel');
  expect(alert.mock.calls.at(-1)![1]).toContain('nicht nachweisbar');
  act(() => alert.mock.calls.at(-1)![2]!.find(button => button.text === 'Tags bereinigen')!.onPress!());
  expect(open).toHaveBeenCalledWith(['a']); alert.mockRestore();
});


test('library menu starts selection without triggering playback or cleaning automatically', () => {
  const close = jest.fn(); const open = jest.fn(); const noop = jest.fn();
  const screen = render(<LibrarySelectionProvider songs={[a,b]} visibleSongs={[a,b]} onOpenCleaner={open}>
    <LibrarySelectionActions /><LibraryMenuModal visible loading={false} isReady hasSongs activeFolders={0}
      onClose={close} onImport={noop} onRefreshMetadata={noop} onAddFolder={noop} onShowFolders={noop}
      onOpenSettings={noop} onOpenEqualizer={noop} />
  </LibrarySelectionProvider>);
  fireEvent.press(screen.getByText('Auswählen')); expect(close).toHaveBeenCalledTimes(1);
  expect(screen.getByText('0 ausgewählt · 2 auf dieser Liste')).toBeTruthy(); expect(open).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Alle auf dieser Liste auswählen')); fireEvent.press(screen.getByText('Tags bereinigen'));
  expect(open).toHaveBeenCalledWith(['a','b']);
});
