import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNowPlayingMusicContext } from '../contexts/MusicContext';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import { useNowPlayingControlsMode } from '../hooks/useNowPlayingControlsMode';
import { useNowPlayingFavorite } from './useNowPlayingFavorite';
import { useNowPlayingMenu } from './useNowPlayingMenu';
import { useNowPlayingPresentation } from './useNowPlayingPresentation';
import { useNowPlayingQueue } from './useNowPlayingQueue';
import { useSleepTimer } from './useSleepTimer';

export const buildSavedQueuePlaylistName = (date = new Date()): string => {
  const ts = date.toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return `Gespeicherte Warteschlange — ${ts}`;
};

const noopQueueShift = async (): Promise<boolean> => false;

export const useNowPlayingScreenState = () => {
  const insets = useSafeAreaInsets();
  const {
    playbackQueue,
    currentSong,
    seekTo,
    isPlaying,
    togglePlayPause,
    volume,
    setVolume,
    palette,
    playSong,
    next,
    previous,
    reorderQueue,
    saveQueueAsPlaylist,
  } = useNowPlayingMusicContext();
  const { position, duration } = usePlaybackProgress();
  const favoriteState = useNowPlayingFavorite(currentSong?.id);
  const menuState = useNowPlayingMenu(currentSong?.id);
  const queueState = useNowPlayingQueue({ playbackQueue, currentSong, playSong });
  const presentation = useNowPlayingPresentation({ currentSong, palette });
  const { mode: controlsMode } = useNowPlayingControlsMode();
  const sleepTimerState = useSleepTimer({
    isPlaying,
    pausePlayback: togglePlayPause,
  });
  const queueShift = reorderQueue ?? noopQueueShift;

  const saveCurrentQueueAsPlaylist = () => {
    const playlist = saveQueueAsPlaylist(buildSavedQueuePlaylistName(), playbackQueue);
    if (!playlist) {
      Alert.alert('Warteschlange speichern', 'Die aktuelle Warteschlange enthält keine Titel.');
      return;
    }
    Alert.alert('Playlist gespeichert', `„${playlist.name}“ wurde erstellt.`);
  };

  const swipeToNext = () => {
    void next();
  };

  const swipeToPrevious = () => {
    void previous();
  };

  return {
    currentSong,
    seekTo,
    isPlaying,
    togglePlayPause,
    volume,
    setVolume,
    position,
    duration,
    bottomInset: insets.bottom,
    controlsMode,
    swipeToNext,
    swipeToPrevious,
    saveCurrentQueueAsPlaylist,
    moveQueueItem: queueShift,
    canReorderQueue: queueState.queue.length > 1 && !!reorderQueue,
    ...favoriteState,
    ...menuState,
    ...sleepTimerState,
    ...queueState,
    ...presentation,
  };
};
