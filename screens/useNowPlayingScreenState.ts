import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNowPlayingMusicContext } from '../contexts/MusicContext';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import { useNowPlayingFavorite } from './useNowPlayingFavorite';
import { useNowPlayingMenu } from './useNowPlayingMenu';
import { useNowPlayingPresentation } from './useNowPlayingPresentation';
import { useNowPlayingQueue } from './useNowPlayingQueue';

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
    fftBins,
    visualizerError,
    playSong,
    saveQueueAsPlaylist,
  } = useNowPlayingMusicContext();
  const { position, duration } = usePlaybackProgress();
  const favoriteState = useNowPlayingFavorite(currentSong?.id);
  const menuState = useNowPlayingMenu(currentSong?.id);
  const queueState = useNowPlayingQueue({ playbackQueue, currentSong, playSong });
  const presentation = useNowPlayingPresentation({
    currentSong,
    palette,
    visualizerError,
  });

  const saveCurrentQueueAsPlaylist = () => {
    const playlist = saveQueueAsPlaylist('Gespeicherte Queue', playbackQueue);
    if (!playlist) {
      Alert.alert('Queue speichern', 'Die aktuelle Queue enthält keine Songs.');
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
    fftBins,
    position,
    duration,
    bottomInset: insets.bottom,
    showVisualizer: false,
    saveCurrentQueueAsPlaylist,
    ...favoriteState,
    ...menuState,
    ...queueState,
    ...presentation,
  };
};
