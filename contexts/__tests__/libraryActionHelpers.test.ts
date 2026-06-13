import TrackPlayer from 'react-native-track-player';
import {
  mergeUniqueSongs,
  normalizeSongIdForLibrary,
  normalizeSongUriForLibraryDedupe,
  patchNullableSongById,
  patchSongById,
  patchSongRefs,
  pruneNullableSongByValidIds,
  pruneSongsByValidIds,
  syncSongRefsToLibrary,
  updateNativeMetadataForSong,
} from '../libraryActionHelpers';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'A', uri: 'file:///s1.mp3' },
  { id: 's2', title: 'Two', artist: 'B', uri: 'file:///s2.mp3' },
];

const song = (id: string, uri?: string, fileUri?: string): Song => ({
  id,
  title: id,
  artist: 'Artist',
  uri,
  fileInfo: fileUri ? { uri: fileUri } : undefined,
});

const createSongRef = (current: Song[] = []) => ({ current });

describe('libraryActionHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('normalizes song ids for library actions', () => {
    expect(normalizeSongIdForLibrary(' s1 ')).toBe('s1');
    expect(normalizeSongIdForLibrary('')).toBeUndefined();
    expect(normalizeSongIdForLibrary('   ')).toBeUndefined();
    expect(normalizeSongIdForLibrary(undefined)).toBeUndefined();
  });

  test('normalizes song URIs for library-level dedupe', () => {
    expect(normalizeSongUriForLibraryDedupe(song('a', 'file:///Music/My%20Song.mp3?token=1#x'))).toBe('file:///Music/My Song.mp3');
    expect(normalizeSongUriForLibraryDedupe(song('a', 'file:///Music\\Song.mp3'))).toBe('file:///Music/Song.mp3');
    expect(normalizeSongUriForLibraryDedupe(song('a', 'file:///ignored.mp3', 'file:///Music/Real.mp3?x=1'))).toBe('file:///Music/Real.mp3');
  });

  test('merges unique songs by normalized id', () => {
    expect(mergeUniqueSongs([songs[0]], [{ ...songs[0], id: ' s1 ' }, songs[1]])).toEqual(songs);
  });

  test('drops incoming songs with blank ids while merging', () => {
    expect(mergeUniqueSongs([songs[0]], [song('   ', 'file:///blank.mp3'), songs[1]])).toEqual(songs);
  });

  test('merges by normalized URI so repeated imports do not duplicate tracks', () => {
    const current = [
      song('s1', 'file:///Music/Song.mp3?token=1'),
      song('s2', 'file:///Music/Other.mp3'),
    ];
    const incoming = [
      song('s1', 'file:///Music/Song-duplicate-id.mp3'),
      song('new-id-same-uri', 'file:///Music/Song.mp3?token=2'),
      song(' s3 ', 'file:///Music/Third.mp3'),
    ];

    expect(mergeUniqueSongs(current, incoming).map(item => item.id)).toEqual(['s1', 's2', 's3']);
  });

  test('still allows URI-less songs when ids are unique', () => {
    expect(mergeUniqueSongs([song('s1')], [song(' s2 '), song('s1')]).map(item => item.id)).toEqual(['s1', 's2']);
  });

  test('prunes songs by normalized valid ids while preserving order', () => {
    const validSongIds = new Set([' s2 ', 's4']);
    const input = [song('s1'), song(' s2 '), song('   '), song('s3'), song('s4')];

    expect(pruneSongsByValidIds(input, validSongIds).map(item => item.id)).toEqual(['s2', 's4']);
    expect(pruneSongsByValidIds(songs, new Set(['s1', 's2']))).toBe(songs);
  });

  test('prunes nullable current song by normalized valid ids', () => {
    expect(pruneNullableSongByValidIds(songs[0], new Set(['s2']))).toBeNull();
    expect(pruneNullableSongByValidIds({ ...songs[0], id: ' s1 ' }, new Set(['s1']))).toEqual(songs[0]);
    expect(pruneNullableSongByValidIds(null, new Set(['s1']))).toBeNull();
  });

  test('syncs queue refs to the current library', () => {
    const queueRef = createSongRef([song('s1'), song(' s2 '), song('missing')]);
    const baseRef = createSongRef([song('missing'), song('s2')]);
    const nativeRef = createSongRef([song(' s1 '), song('missing')]);

    syncSongRefsToLibrary(new Set(['s1', 's2']), [queueRef, baseRef, nativeRef]);

    expect(queueRef.current.map(item => item.id)).toEqual(['s1', 's2']);
    expect(baseRef.current.map(item => item.id)).toEqual(['s2']);
    expect(nativeRef.current.map(item => item.id)).toEqual(['s1']);
  });

  test('patches song values by normalized id', () => {
    expect(patchSongById(' s1 ', { title: 'Updated' })({ ...songs[0], id: ' s1 ' })).toEqual({ ...songs[0], title: 'Updated' });
    expect(patchSongById('   ', { title: 'Updated' })(songs[0])).toBe(songs[0]);
    expect(patchSongById('missing', { title: 'Updated' })(songs[0])).toBe(songs[0]);
    expect(patchNullableSongById('s1', { title: 'Updated' }, songs[0])?.title).toBe('Updated');
    expect(patchNullableSongById('missing', { title: 'Updated' }, songs[0])).toBe(songs[0]);
    expect(patchNullableSongById('s1', { title: 'Updated' }, null)).toBeNull();
  });

  test('patches song refs', () => {
    const queueRef = createSongRef(songs.slice());
    const baseRef = createSongRef(songs.slice());

    patchSongRefs(patchSongById('s1', { title: 'Updated' }), [queueRef, baseRef]);

    expect(queueRef.current[0].title).toBe('Updated');
    expect(baseRef.current[0].title).toBe('Updated');
  });

  test('updates native metadata for queued song by normalized id', () => {
    const nativeQueueRef = createSongRef([{ ...songs[0], id: ' s1 ', title: 'Updated' }, songs[1]]);
    const baseQueueContextRef = createSongRef(songs.slice());

    updateNativeMetadataForSong('s1', nativeQueueRef, baseQueueContextRef);

    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ title: 'Updated' }),
    );
  });

  test('skips native metadata update when song is not queued or id is blank', () => {
    updateNativeMetadataForSong('missing', createSongRef(songs.slice()), createSongRef(songs.slice()));
    updateNativeMetadataForSong('   ', createSongRef(songs.slice()), createSongRef(songs.slice()));

    expect(TrackPlayer.updateMetadataForTrack).not.toHaveBeenCalled();
  });

  test('logs and skips native metadata update when queued song is not playable', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const nativeQueueRef = createSongRef([{ ...songs[0], uri: '   ' }]);
    const baseQueueContextRef = createSongRef(songs.slice());

    updateNativeMetadataForSong('s1', nativeQueueRef, baseQueueContextRef);

    expect(TrackPlayer.updateMetadataForTrack).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[TrackPlayer] Skipping metadata update for non-playable queued song.',
      expect.objectContaining({ songId: 's1', queueIndex: 0 }),
    );
  });

  test('logs native metadata update errors when TrackPlayer update rejects', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (TrackPlayer.updateMetadataForTrack as jest.Mock).mockRejectedValueOnce(new Error('native update failed'));
    const nativeQueueRef = createSongRef([{ ...songs[0], title: 'Updated' }]);
    const baseQueueContextRef = createSongRef(songs.slice());

    updateNativeMetadataForSong('s1', nativeQueueRef, baseQueueContextRef);
    await Promise.resolve();

    expect(warn).toHaveBeenCalledWith(
      '[TrackPlayer] Failed to update native track metadata.',
      expect.objectContaining({ songId: 's1', queueIndex: 0, error: expect.any(Error) }),
    );
  });

  test('updates native metadata with the queued index, artwork and stable track id', () => {
    const nativeQueueRef = createSongRef([
      songs[0],
      { ...songs[1], title: 'Updated Two', cover: ' file:///updated-art.jpg ' },
    ]);
    const baseQueueContextRef = createSongRef(songs.slice());

    updateNativeMetadataForSong('s2', nativeQueueRef, baseQueueContextRef);

    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(1, expect.objectContaining({
      id: 's2',
      title: 'Updated Two',
      artwork: 'file:///updated-art.jpg',
    }));
  });

  test('metadata update allows missing artwork and keeps normalized id stable after tag changes', () => {
    const nativeQueueRef = createSongRef([{ ...songs[0], id: ' s1 ', title: 'Retagged One', album: 'New Album', cover: undefined }]);
    const baseQueueContextRef = createSongRef(songs.slice());

    updateNativeMetadataForSong('s1', nativeQueueRef, baseQueueContextRef);

    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(0, expect.objectContaining({
      id: 's1',
      title: 'Retagged One',
      album: 'New Album',
      artwork: undefined,
    }));
  });

});
