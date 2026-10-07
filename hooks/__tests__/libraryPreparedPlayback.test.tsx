import { act, renderHook } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLibrarySongRenderer } from '../useLibrarySongRenderer';
import { useLibraryPlaybackActions } from '../useLibraryPlaybackActions';
import { useLibraryGroupRenderers } from '../useLibraryGroupRenderers';
import { getWaveformSourceIdentity } from '../../utils/waveformGenerator';
import { markSongPrepared, resetSongPreparationForTests } from '../../utils/songPreparationStore';
import { resetWaveformStatusForTests } from '../../utils/waveformStatus';
import type { LibraryGroupItem } from '../../utils/libraryPresentation';

const songs = ['waiting', 'ready', 'later'].map(id => ({ id, title: id, artist: 'Artist', uri: `file:///${id}.mp3` }));
beforeEach(async () => {
  resetSongPreparationForTests(); resetWaveformStatusForTests(); await AsyncStorage.clear();
  await markSongPrepared(getWaveformSourceIdentity(songs[1]).sourceFingerprint);
});

test('allows readable audio without waveform analysis and preserves the playback queue', async () => {
  const playSong = jest.fn();
  const { result } = renderHook(() => useLibrarySongRenderer({ currentSongId: null, filteredSongs: songs,
    isPlaying: false, onOpenTrackInfo: jest.fn(), playSong }));
  await act(async () => result.current.handleSongPress(songs[0]));
  expect(playSong).toHaveBeenCalledWith(songs[0], songs);
  await act(async () => result.current.handleSongPress(songs[1]));
  expect(playSong).toHaveBeenCalledWith(songs[1], songs);
});

test('list play and shuffle do not depend on analysis history', async () => {
  const handleSongPress = jest.fn(); const playSong = jest.fn();
  const { result } = renderHook(() => useLibraryPlaybackActions({ handleSongPress, playSong,
    setAlbumViewMode: jest.fn(), songsForActiveList: songs }));
  await act(async () => result.current.handlePlayActiveList());
  expect(handleSongPress).toHaveBeenCalledWith(songs[0], songs);
  await act(async () => result.current.handleShufflePress());
  expect(playSong).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }), expect.arrayContaining(songs));
});

test('album and artist start the first audio track without waiting for analysis', () => {
  const handleSongPress = jest.fn();
  const { result } = renderHook(() => useLibraryGroupRenderers({ handleSongPress }));
  const group = { id: 'album', songs } as LibraryGroupItem;
  const artist = result.current.renderGroupItem({ item: group });
  const album = result.current.renderAlbumTile({ item: group });
  (artist.props as { onPress: (group: LibraryGroupItem) => void }).onPress(group);
  (album.props as { onPress: (group: LibraryGroupItem) => void }).onPress(group);
  expect(handleSongPress).toHaveBeenCalledTimes(2);
  expect(handleSongPress).toHaveBeenLastCalledWith(songs[0], songs);
});
