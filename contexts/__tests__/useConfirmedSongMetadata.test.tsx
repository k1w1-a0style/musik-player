import { renderHook } from '@testing-library/react-native';
import { createSongLibraryState } from '../songLibraryState';
import { useConfirmedSongMetadata } from '../useConfirmedSongMetadata';
import type { Song } from '../../types/Song';

const original: Song = { id: 'one', title: 'Original', artist: 'Artist' };
test('missing readiness or a removed source cannot report success or modify metadata', async () => {
  const update = jest.fn();
  const { result, rerender } = renderHook(({ library }: { library: ReturnType<typeof createSongLibraryState> | undefined }) => useConfirmedSongMetadata(library, update),
    { initialProps: { library: undefined as ReturnType<typeof createSongLibraryState> | undefined } });
  await expect(result.current('one', { title: 'Clean' })).rejects.toThrow('nicht bereit');
  rerender({ library: createSongLibraryState([]) });
  await expect(result.current('one', { title: 'Clean' })).rejects.toThrow('nicht mehr');
  expect(update).not.toHaveBeenCalled();
});
test('public confirmed metadata action uses the same writer and propagates failed acknowledgement', async () => {
  const library = createSongLibraryState([original]);
  const update = (id: string, patch: Partial<Song>) => library.setSongs(songs =>
    songs.map(song => song.id === id ? { ...song, ...patch } : song));
  const { result } = renderHook(() => useConfirmedSongMetadata(library, update));
  library.configurePersistence(async () => { throw new Error('Disk full'); });
  await expect(result.current('one', { title: 'Clean' })).rejects.toThrow('Disk full');
  let stored: Song[] = [];
  library.configurePersistence(async read => { stored = read(); return stored; });
  await result.current('one', { title: 'Clean' });
  expect(stored[0].title).toBe('Clean');
});
