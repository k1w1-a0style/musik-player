import { act, renderHook } from '@testing-library/react-native';
import { SystemAudio } from 'expo-system-audio';
import { useArtworkThumbnail } from '../useArtworkThumbnail';

const create = SystemAudio.createArtworkThumbnail as jest.Mock;

beforeEach(() => { create.mockReset().mockResolvedValue(null); });

test('keeps originals when unavailable and leaves provider/remote URIs alone', async () => {
  const { result, rerender } = renderHook(({ uri }: { uri: string }) => useArtworkThumbnail(uri, 128),
    { initialProps: { uri: 'content://cover' } });
  expect(result.current).toBe('content://cover');
  expect(create).not.toHaveBeenCalled();
  rerender({ uri: 'file://original' });
  await act(async () => {});
  expect(result.current).toBe('file://original');
});

test('obsolete completion cannot replace a new cover or revision', async () => {
  let complete!: (value: string) => void;
  create.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }))
    .mockResolvedValueOnce('file://new-thumbnail');
  const { result, rerender } = renderHook(({ revision }: { revision: string }) => useArtworkThumbnail('file://cover', 128, revision),
    { initialProps: { revision: 'old' } });
  rerender({ revision: 'new' });
  await act(async () => {});
  expect(result.current).toBe('file://new-thumbnail');
  await act(async () => { complete('file://old-thumbnail'); });
  expect(result.current).toBe('file://new-thumbnail');
  expect(create).toHaveBeenLastCalledWith('file://cover', 128, 'new');
});

test('rejection falls back without an unhandled promise or state write after unmount', async () => {
  create.mockRejectedValueOnce(new Error('cache unavailable'));
  const { result, unmount } = renderHook(() => useArtworkThumbnail('file://original'));
  await act(async () => {});
  expect(result.current).toBe('file://original');
  unmount();
});
