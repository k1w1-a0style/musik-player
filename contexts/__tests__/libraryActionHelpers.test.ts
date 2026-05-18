import TrackPlayer from 'react-native-track-player';
import {
  mergeUniqueSongs,
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

const createSongRef = (current: Song[] = []) => ({ current });

describe('libraryActionHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('merges unique songs', () => {
    expect(mergeUniqueSongs([songs[0]], [songs[0], songs[1]])).toEqual(songs);
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
