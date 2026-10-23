import { act, renderHook } from '@testing-library/react-native';
import { usePlaylistFileImport } from '../usePlaylistFileImport';
import { pickPlaylistFile, verifyPlaylistSources } from '../../utils/playlistFiles';
import type { PlaylistImportPreview } from '../../utils/playlistFiles';
import type { Song } from '../../types/Song';

jest.mock('../../utils/playlistFiles', () => ({ pickPlaylistFile: jest.fn(), verifyPlaylistSources: jest.fn() }));
const songs: Song[] = [{ id: '1', title: 'Original', artist: 'Kiwi', uri: 'content://audio/1' }];
const preview: PlaylistImportPreview = { name: 'Mix', songs, unresolved: [], duplicates: 0 };
const pick = pickPlaylistFile as jest.Mock;
const verify = verifyPlaylistSources as jest.Mock;
const save = jest.fn();
beforeEach(() => {
  jest.resetAllMocks(); pick.mockResolvedValue(preview);
  verify.mockResolvedValue({ readable: songs, unreadable: [] });
  save.mockReturnValue({ id: 'new-playlist' });
});
test('selection previews first, confirmation reads sources and reuses the existing playlist action exactly once', async () => {
  const { result } = renderHook(() => usePlaylistFileImport(songs, save));
  await act(() => result.current.pick());
  expect(result.current.preview).toEqual(preview); expect(save).not.toHaveBeenCalled();
  await act(() => result.current.confirm());
  expect(verify).toHaveBeenCalledWith(songs, expect.any(AbortSignal), expect.any(Function));
  expect(save).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledWith('Mix', songs);
  expect(result.current.preview).toBeNull(); expect(result.current.busy).toBe(false);
});
test('revoked sources update preview and require another explicit confirmation, leaving library unchanged', async () => {
  const { result } = renderHook(() => usePlaylistFileImport(songs, save));
  await act(() => result.current.pick());
  verify.mockResolvedValueOnce({ readable: [], unreadable: songs });
  await act(() => result.current.confirm());
  expect(save).not.toHaveBeenCalled(); expect(result.current.preview?.songs).toEqual([]);
  expect(result.current.preview?.unresolved[0].reason).toBe('unreadable');
  expect(result.current.error).toContain('erneut'); expect(songs[0].title).toBe('Original');
});
test('cancelling delayed verification prevents late persistence and another concurrent operation', async () => {
  let finish!: (value: unknown) => void;
  verify.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => usePlaylistFileImport(songs, save));
  await act(() => result.current.pick());
  let pending!: Promise<void>;
  act(() => { pending = result.current.confirm(); });
  await act(() => result.current.confirm()); expect(verify).toHaveBeenCalledTimes(1);
  act(() => result.current.cancel());
  await act(async () => { finish({ readable: songs, unreadable: [] }); await pending; });
  expect(save).not.toHaveBeenCalled(); expect(result.current.preview).toBeNull();
});
test('removal or source change while preview is open fails closed', async () => {
  const { result, rerender } = renderHook(({ library }: { library: Song[] }) => usePlaylistFileImport(library, save), { initialProps: { library: songs } });
  await act(() => result.current.pick()); rerender({ library: [] });
  await act(() => result.current.confirm());
  expect(save).not.toHaveBeenCalled(); expect(verify).not.toHaveBeenCalled();
  expect(result.current.error).toContain('Bibliothek');
});
test('file errors and failed creation stay visible without clearing existing state', async () => {
  const { result } = renderHook(() => usePlaylistFileImport(songs, save));
  pick.mockRejectedValueOnce(new Error('Zugriff verweigert'));
  await act(() => result.current.pick()); expect(result.current.error).toBe('Zugriff verweigert');
  await act(() => result.current.pick()); save.mockReturnValueOnce(null);
  await act(() => result.current.confirm());
  expect(result.current.preview).toEqual(preview); expect(result.current.error).toContain('Keine lesbaren');
});
test('background metadata refresh preserves a stable source, while a changed URI requires new selection', async () => {
  const { result, rerender } = renderHook(({ library }: { library: Song[] }) => usePlaylistFileImport(library, save), { initialProps: { library: songs } });
  await act(() => result.current.pick());
  rerender({ library: [{ ...songs[0], title: 'Refreshed metadata' }] });
  await act(() => result.current.confirm()); expect(save).toHaveBeenCalledTimes(1);
  await act(() => result.current.pick());
  rerender({ library: [{ ...songs[0], uri: 'content://different/2' }] });
  await act(() => result.current.confirm()); expect(save).toHaveBeenCalledTimes(1);
  expect(result.current.error).toContain('Bibliothek');
});
test('unmount during source read prevents creation', async () => {
  let finish!: (value: unknown) => void;
  verify.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = renderHook(() => usePlaylistFileImport(songs, save));
  await act(() => result.current.pick());
  let pending!: Promise<void>; act(() => { pending = result.current.confirm(); });
  unmount(); finish({ readable: songs, unreadable: [] });
  await pending; expect(save).not.toHaveBeenCalled();
});
