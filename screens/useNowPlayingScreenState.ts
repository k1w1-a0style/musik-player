import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNowPlayingMusicContext } from '../contexts/MusicContext';
import { usePlaybackProgress } from '../contexts/PlaybackProgressContext';
import { useNowPlayingControlsMode } from '../hooks/useNowPlayingControlsMode';
import { useNowPlayingFavorite } from './useNowPlayingFavorite';
import { useNowPlayingMenu } from './useNowPlayingMenu';
import { useNowPlayingPresentation } from './useNowPlayingPresentation';
import { useNowPlayingQueue } from './useNowPlayingQueue';
import { canSkipToNextInQueue } from '../utils/playbackQueueGuards';
import { getSongArtworkUri } from '../utils/songArtwork';
import type { Song } from '../types/Song';

export const buildSavedQueuePlaylistName = (date = new Date()): string => {
  const ts = date.toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return `Gespeicherte Warteschlange — ${ts}`;
};

const noopQueueShift = async (): Promise<boolean> => false;

export const getAdjacentNowPlayingSongs = (playbackQueue: Song[], currentSong: Song | null) => {
  if (!currentSong) return { previousSong: null, nextSong: null };
  const currentIndex = playbackQueue.findIndex(song => song.id === currentSong.id);
  if (currentIndex < 0) return { previousSong: null, nextSong: null };

  return {
    previousSong: playbackQueue[currentIndex - 1] ?? null,
    nextSong: playbackQueue[currentIndex + 1] ?? null,
  };
};

export const useNowPlayingScreenState = () => {
  const insets = useSafeAreaInsets();
  const {
    playbackQueue,
    currentSong,
    seekTo,
    isPlaying,
    sleepTimerActive,
    startSleepTimer,
    cancelSleepTimer,
    volume,
    setVolume,
    palette,
    playSong,
    next,
    previous,
    reorderQueue,
    saveQueueAsPlaylist,
    repeatMode,
  } = useNowPlayingMusicContext();
  const { position, duration } = usePlaybackProgress();
  const favoriteState = useNowPlayingFavorite(currentSong?.id);
  const menuState = useNowPlayingMenu(currentSong?.id);
  const queueState = useNowPlayingQueue({ playbackQueue, currentSong, playSong });
  const presentation = useNowPlayingPresentation({ currentSong, palette });
  const { mode: controlsMode } = useNowPlayingControlsMode();
  const queueShift = reorderQueue ?? noopQueueShift;

  const saveCurrentQueueAsPlaylist = () => {
    const playlist = saveQueueAsPlaylist(buildSavedQueuePlaylistName(), playbackQueue);
    if (!playlist) {
      Alert.alert('Warteschlange speichern', 'Die aktuelle Warteschlange enthält keine Titel.');
      return;
    }
    Alert.alert('Playlist gespeichert', `„${playlist.name}“ wurde erstellt.`);
  };

  const canSwipeToNext = canSkipToNextInQueue({ currentSong, playbackQueue, repeatMode });
  const adjacentSongs = getAdjacentNowPlayingSongs(playbackQueue, currentSong);

  const swipeToNext = () => {
    if (!canSwipeToNext) return;
    void next();
  };

  const swipeToPrevious = () => {
    void previous();
  };

  return {
    currentSong,
    playbackQueue,
    ...adjacentSongs,
    previousArtworkUri: getSongArtworkUri(adjacentSongs.previousSong),
    nextArtworkUri: getSongArtworkUri(adjacentSongs.nextSong),
    seekTo,
    isPlaying,
    sleepTimerActive,
    startSleepTimer,
    cancelSleepTimer,
    volume,
    setVolume,
    position,
    duration,
    bottomInset: insets.bottom,
    controlsMode,
    swipeToNext,
    swipeToPrevious,
    canSwipeToNext,
    saveCurrentQueueAsPlaylist,
    moveQueueItem: queueShift,
    canReorderQueue: queueState.queue.length > 1 && !!reorderQueue,
    ...favoriteState,
    ...menuState,
    ...queueState,
    ...presentation,
  };
};
