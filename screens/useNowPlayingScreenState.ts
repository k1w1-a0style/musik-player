import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNowPlayingMusicContext } from '../contexts/MusicContext';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import { useNowPlayingFavorite } from './useNowPlayingFavorite';
import { useNowPlayingMenu } from './useNowPlayingMenu';
import { useNowPlayingPresentation } from './useNowPlayingPresentation';
import { useNowPlayingQueue } from './useNowPlayingQueue';

export const buildSavedQueuePlaylistName = (date = new Date()): string => {
  const ts = date.toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return `Gespeicherte Warteschlange — ${ts}`;
};

export const useNowPlayingScreenState = () => {
  const insets = useSafeAreaInsets();
  const {
    playbackQueue,
    currentSong,
    seekTo,
    isPlaying,
    volume,
    setVolume,
    palette,
    playSong,
    reorderQueue,
    saveQueueAsPlaylist,
  } = useNowPlayingMusicContext();
  const { position, duration } = usePlaybackProgress();
  const favoriteState = useNowPlayingFavorite(currentSong?.id);
  const menuState = useNowPlayingMenu(currentSong?.id);
  const queueState = useNowPlayingQueue({ playbackQueue, currentSong, playSong, reorderQueue });
  const presentation = useNowPlayingPresentation({
    currentSong,
    palette,
  });

  const saveCurrentQueueAsPlaylist = () => {
    const playlist = saveQueueAsPlaylist(buildSavedQueuePlaylistName(), playbackQueue);
    if (!playlist) {
      Alert.alert('Warteschlange speichern', 'Die aktuelle Warteschlange enthält keine Titel.');
      return;
    }
    Alert.alert('Playlist gespeichert', `„${playlist.name}“ wurde erstellt.`);
  };

  return {
    currentSong,
    seekTo,
    isPlaying,
    volume,
    setVolume,
    position,
    duration,
    bottomInset: insets.bottom,
    saveCurrentQueueAsPlaylist,
    ...favoriteState,
    ...menuState,
    ...queueState,
    ...presentation,
  };
};
