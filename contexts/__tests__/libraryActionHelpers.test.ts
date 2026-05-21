import TrackPlayer from 'react-native-track-player';
import {
  mergeUniqueSongs,
  normalizeSongUriForLibraryDedupe,
  patchNullableSongById,
  patchSongById,
  patchSongRefs,
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

  test('normalizes song URIs for library-level dedupe', () => {
    expect(normalizeSongUriForLibraryDedupe(song('a', 'file:///Music/My%20Song.mp3?token=1#x'))).toBe('file:///Music/My Song.mp3');
    expect(normalizeSongUriForLibraryDedupe(song('a', 'file:///Music\\Song.mp3'))).toBe('file:///Music/Song.mp3');
    expect(normalizeSongUriForLibraryDedupe(song('a', 'file:///ignored.mp3', 'file:///Music/Real.mp3?x=1'))).toBe('file:///Music/Real.mp3');
  });

  test('merges unique songs by id', () => {
    expect(mergeUniqueSongs([songs[0]], [songs[0], songs[1]])).toEqual(songs);
  });

  test('merges by normalized URI so repeated imports do not duplicate tracks', () => {
    const current = [
      song('s1', 'file:///Music/Song.mp3?token=1'),
      song('s2', 'file:///Music/Other.mp3'),
    ];
    const incoming = [
      song('s1', 'file:///Music/Song-duplicate-id.mp3'),
      song('new-id-same-uri', 'file:///Music/Song.mp3?token=2'),
      song('s3', 'file:///Music/Third.mp3'),
    ];

    expect(mergeUniqueSongs(current, incoming).map(item => item.id)).toEqual(['s1', 's2', 's3']);
  });

  test('still allows URI-less songs when ids are unique', () => {
    expect(mergeUniqueSongs([song('s1')], [song('s2'), song('s1')]).map(item => item.id)).toEqual(['s1', 's2']);
  });

  test('patches song values by id', () => {
    expect(patchSongById('s1', { title: 'Updated' })(songs[0]).title).toBe('Updated');
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

  test('updates native metadata for queued song', () => {
    const nativeQueueRef = createSongRef([{ ...songs[0], title: 'Updated' }, songs[1]]);
    const baseQueueContextRef = createSongRef(songs.slice());

    updateNativeMetadataForSong('s1', nativeQueueRef, baseQueueContextRef);

    expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ title: 'Updated' }),
    );
  });

  test('skips native metadata update when song is not queued', () => {
    updateNativeMetadataForSong('missing', createSongRef(songs.slice()), createSongRef(songs.slice()));

    expect(TrackPlayer.updateMetadataForTrack).not.toHaveBeenCalled();
  });
});
