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

test('rejects a direct unprepared selection and filters the playback queue to prepared tracks', async () => {
  const playSong = jest.fn();
  const { result } = renderHook(() => useLibrarySongRenderer({ currentSongId: null, filteredSongs: songs,
    isPlaying: false, onOpenTrackInfo: jest.fn(), playSong }));
  await act(async () => result.current.handleSongPress(songs[0]));
  expect(playSong).not.toHaveBeenCalled();
  await act(async () => result.current.handleSongPress(songs[1]));
  expect(playSong).toHaveBeenCalledWith(songs[1], [songs[1]]);
});

test('list play and shuffle cannot bypass preparation', async () => {
  const handleSongPress = jest.fn(); const playSong = jest.fn();
  const { result } = renderHook(() => useLibraryPlaybackActions({ handleSongPress, playSong,
    setAlbumViewMode: jest.fn(), songsForActiveList: songs }));
  await act(async () => result.current.handlePlayActiveList());
  expect(handleSongPress).toHaveBeenCalledWith(songs[1], [songs[1]]);
  await act(async () => result.current.handleShufflePress());
  expect(playSong).toHaveBeenCalledWith(songs[1], [songs[1]]);
});

test('album and artist starts choose the first prepared track', () => {
  const handleSongPress = jest.fn();
  const { result } = renderHook(() => useLibraryGroupRenderers({ handleSongPress }));
  const group = { id: 'album', songs } as LibraryGroupItem;
  const artist = result.current.renderGroupItem({ item: group });
  const album = result.current.renderAlbumTile({ item: group });
  (artist.props as { onPress: (group: LibraryGroupItem) => void }).onPress(group);
  (album.props as { onPress: (group: LibraryGroupItem) => void }).onPress(group);
  expect(handleSongPress).toHaveBeenCalledTimes(2);
  expect(handleSongPress).toHaveBeenLastCalledWith(songs[1], [songs[1]]);
});
