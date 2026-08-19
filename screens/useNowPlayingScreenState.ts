import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNowPlayingMusicContext } from '../contexts/MusicContext';
import { useNowPlayingControlsMode } from '../hooks/useNowPlayingControlsMode';
import { useNowPlayingFavorite } from './useNowPlayingFavorite';
import { useNowPlayingMenu } from './useNowPlayingMenu';
import { useNowPlayingPresentation } from './useNowPlayingPresentation';
import { useNowPlayingQueue } from './useNowPlayingQueue';
import { canSkipToNextInQueue } from '../utils/playbackQueueGuards';
import { getSongArtworkUri } from '../utils/songArtwork';
import { runPlaybackUiAction } from '../utils/playbackUiActions';
import type { RepeatMode, Song } from '../types/Song';

export const buildSavedQueuePlaylistName = (date = new Date()): string => {
  const ts = date.toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return `Gespeicherte Warteschlange — ${ts}`;
};

const noopQueueShift = async () => ({ status: 'noop' as const });

type SaveQueueAsPlaylist = ReturnType<typeof useNowPlayingMusicContext>['saveQueueAsPlaylist'];

const savePlaybackQueueAsPlaylist = (
  saveQueueAsPlaylist: SaveQueueAsPlaylist,
  playbackQueue: Song[],
): void => {
  const playlist = saveQueueAsPlaylist(buildSavedQueuePlaylistName(), playbackQueue);
  if (!playlist) {
    Alert.alert('Warteschlange speichern', 'Die aktuelle Warteschlange enthält keine Titel.');
    return;
  }
  Alert.alert('Playlist gespeichert', `„${playlist.name}“ wurde erstellt.`);
};

export const getAdjacentNowPlayingSongs = (
  playbackQueue: Song[],
  currentSong: Song | null,
  repeatMode?: RepeatMode,
) => {
  if (!currentSong) return { previousSong: null, nextSong: null };
  const currentIndex = playbackQueue.findIndex(song => song.id === currentSong.id);
  if (currentIndex < 0) return { previousSong: null, nextSong: null };

  const isRepeatAllQueueEnd = repeatMode === 'all'
    && playbackQueue.length > 1
    && currentIndex === playbackQueue.length - 1;

  return {
    previousSong: playbackQueue[currentIndex - 1] ?? null,
    nextSong: isRepeatAllQueueEnd ? playbackQueue[0] ?? null : playbackQueue[currentIndex + 1] ?? null,
  };
};

export const useNowPlayingScreenState = () => {
  const insets = useSafeAreaInsets();
  const {
    playbackQueue,
    currentSong,
    seekTo,
    isPlaying,
    togglePlayPause,
    sleepTimerActive,
    sleepTimerRemainingSeconds,
    startSleepTimer,
    cancelSleepTimer,
    volume,
    setVolume,
    palette,
    paletteLoading,
    playSong,
    next,
    previous,
    reorderQueue,
    saveQueueAsPlaylist,
    shuffle, toggleShuffle,
    repeatMode, cycleRepeatMode,
  } = useNowPlayingMusicContext();
  const favoriteState = useNowPlayingFavorite(currentSong?.id);
  const menuState = useNowPlayingMenu(currentSong?.id);
  const queueState = useNowPlayingQueue({ playbackQueue, currentSong, playSong });
  const presentation = useNowPlayingPresentation({ currentSong, palette, paletteLoading });
  const { mode: controlsMode, isHydrated: controlsModeHydrated } = useNowPlayingControlsMode();
  const queueShift = reorderQueue ?? noopQueueShift;
  const saveCurrentQueueAsPlaylist = useCallback(
    () => savePlaybackQueueAsPlaylist(saveQueueAsPlaylist, playbackQueue),
    [playbackQueue, saveQueueAsPlaylist],
  );
  const canSwipeToNext = canSkipToNextInQueue({ currentSong, playbackQueue, repeatMode });
  const adjacentSongs = getAdjacentNowPlayingSongs(playbackQueue, currentSong, repeatMode);

  const swipeToNext = useCallback(() => {
    if (!canSwipeToNext) return Promise.resolve();
    return runPlaybackUiAction('now-playing-next', next, { dropIfPending: true });
  }, [canSwipeToNext, next]);

  const swipeToPrevious = useCallback(() => runPlaybackUiAction(
    'now-playing-previous', previous, { dropIfPending: true }), [previous]);

  return {
    currentSong,
    playbackQueue,
    ...adjacentSongs,
    previousArtworkUri: getSongArtworkUri(adjacentSongs.previousSong),
    nextArtworkUri: getSongArtworkUri(adjacentSongs.nextSong),
    seekTo,
    isPlaying,
    togglePlayPause,
    sleepTimerActive,
    sleepTimerRemainingSeconds,
    startSleepTimer,
    cancelSleepTimer,
    volume,
    setVolume,
    bottomInset: insets.bottom,
    topInset: insets.top,
    controlsMode,
    controlsModeHydrated,
    swipeToNext,
    swipeToPrevious,
    canSwipeToNext,
    shuffle, toggleShuffle,
    repeatMode, cycleRepeatMode,
    paletteLoading,
    saveCurrentQueueAsPlaylist,
    moveQueueItem: queueShift,
    canReorderQueue: queueState.queue.length > 1 && !!reorderQueue,
    ...favoriteState,
    ...menuState,
    ...queueState,
    ...presentation,
  };
};
