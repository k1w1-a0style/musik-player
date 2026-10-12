import { renderHook } from '@testing-library/react-native';
import { useLibrarySelectionScope } from '../useLibrarySelectionScope';
import type { Song } from '../../types/Song';
const a: Song = { id: 'a', title: 'A', artist: 'Artist', uri: 'file:///Music/Album/a.mp3' };
const b: Song = { id: 'b', title: 'B', artist: 'Artist', uri: 'file:///Other/b.mp3' };
const base = { songs: [a,b], songsForActiveList: [a,b], playlistItems: [], scanFolders: [], activeTab: 'tracks' as const, onOpenCleaner: jest.fn() };
test('uses only contained tracks in the shown playlists, dedup left to shared store', () => {
  const { result } = renderHook(() => useLibrarySelectionScope({ ...base, activeTab: 'playlists', playlistItems: [
    { id: 'p', name: 'Shown Playlist', songs: [a], totalCount: 1, validCount: 1 },
  ] }));
  expect(result.current.visibleSongs).toEqual([a]);
});
test('uses only proven recursive folder members instead of entire library', () => {
  const { result } = renderHook(() => useLibrarySelectionScope({ ...base, activeTab: 'folders', scanFolders: [
    { id: 'f', name: 'Music', uri: 'file:///Music', enabled: true, addedAt: 1 },
  ] }));
  expect(result.current.visibleSongs).toEqual([a]);
});
test('preserves reference for unchanged scope so selection context stays stable', () => {
  const { result, rerender } = renderHook(() => useLibrarySelectionScope(base)); const first = result.current;
  rerender({}); expect(result.current).toBe(first);
});
