import { renderHook } from '@testing-library/react-native';
import { useLibraryImportStateUpdate } from '../useLibraryImportStateUpdate';

const song = (id: string) => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` });

test('an immediately restarted import retains accepted chunks before song props rerender', () => {
  const setSongs = jest.fn();
  const songs = [song('existing')];
  const { result } = renderHook(() => useLibraryImportStateUpdate({ songs, setSongs, setActiveTab: jest.fn(), ensureCurrentImport: jest.fn() }));
  result.current.applyImportedSongsUpdate({ songs: [...songs, song('first')], activeTab: 'tracks' }, { id: 1, controller: new AbortController() });
  const accepted = result.current.applyImportedSongsUpdate({ songs: [...songs, song('second')], activeTab: 'tracks' }, { id: 2, controller: new AbortController() });
  expect(accepted.map(item => item.id)).toEqual(['existing', 'first', 'second']);
  expect(setSongs).toHaveBeenLastCalledWith(accepted);
});

test('stale generations cannot update the baseline used by the next import', () => {
  const setSongs = jest.fn();
  const ensureCurrentImport = jest.fn(() => { throw new Error('superseded'); });
  const songs = [song('existing')];
  const { result } = renderHook(() => useLibraryImportStateUpdate({ songs, setSongs, setActiveTab: jest.fn(), ensureCurrentImport }));
  expect(() => result.current.applyImportedSongsUpdate({ songs: [song('stale')], activeTab: 'tracks' },
    { id: 1, controller: new AbortController() })).toThrow('superseded');
  expect(setSongs).not.toHaveBeenCalled();
});
