import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import TrackPlayer, {
  Event,
  State,
  usePlaybackState,
} from 'react-native-track-player';
import {
  EQ_PRESETS,
  type EqPresetName,
  type Playlist,
  type RepeatMode,
  type Song,
} from '../types/Song';
import { StorageKeys, storage } from '../utils/storage';
import { sanitizeSongsForStorage } from '../utils/coverCache';
import { getSongArtworkUri } from '../utils/songArtwork';
import { createPlaylistId } from '../utils/playlistIds';
import { toTrackPlayerRepeatMode } from '../utils/audioPlaybackModes';
import {
  clampNativeEqMillibel,
  dbToMillibel,
  findClosestUiEqBandIndex,
} from '../utils/nativeEqualizer';
import {
  addSongToPlaylistById,
  deletePlaylistById,
  prunePlaylists,
  removeSongFromPlaylistById,
  renamePlaylistById,
} from '../utils/playlistState';
import { setupTrackPlayer } from '../utils/trackPlayerSetup';
import { toTrackPlayerTrack } from '../utils/trackPlayerTrack';
import {
  buildHydratedPlaybackQueue,
  didSongCoversChange,
} from '../utils/musicHydration';
import {
  buildPlaySongQueuePlan,
  buildShuffleTogglePlan,
} from '../utils/playbackPlan';
import { createRequiredContextHook } from './createRequiredContextHook';
import {
  buildLibraryMusicContextValue,
  buildMiniPlayerMusicContextValue,
  buildMusicContextValue,
  buildNowPlayingMusicContextValue,
} from './musicContextValues';
import type {
  LibraryMusicContextValue,
  MiniPlayerMusicContextValue,
  MusicContextValue,
  NowPlayingMusicContextValue,
} from './musicContextTypes';
import SystemAudio, { type EqInitResult, type PaletteResult } from 'expo-system-audio';

const MusicContext = createContext<MusicContextValue | null>(null);
const LibraryMusicContext = createContext<LibraryMusicContextValue | null>(null);
const MiniPlayerMusicContext = createContext<MiniPlayerMusicContextValue | null>(null);
const NowPlayingMusicContext = createContext<NowPlayingMusicContextValue | null>(null);

const VISUALIZER_UPDATE_INTERVAL_MS = 120;

const trackPlayerWithSkip = TrackPlayer as typeof TrackPlayer & {
  skip?: (index: number, initialPosition?: number) => Promise<void>;
};

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  const [songs, setSongsState] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playbackQueue, setPlaybackQueue] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolumeState] = useState(1);

  const [eqEnabled, setEqEnabledState] = useState(false);
  const [eqBands, setEqBandsState] = useState<number[]>(EQ_PRESETS.flat.slice());
  const [eqPreset, setEqPreset] = useState<EqPresetName | 'custom'>('flat');
  const [eqNative, setEqNative] = useState<EqInitResult | null>(null);

  // Visualizer + palette. Native FFT capture stays opt-in; normal playback must not
  // request RECORD_AUDIO or stream high-frequency state updates by default.
  const [fftBins, setFftBins] = useState<number[]>(() => new Array(16).fill(0));
  const [visualizerRunning, setVisualizerRunning] = useState(false);
  const [visualizerError, setVisualizerError] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteResult | null>(null);

  const songsRef = useRef(songs);
  songsRef.current = songs;
  const queueContextRef = useRef<Song[]>([]);
  const baseQueueContextRef = useRef<Song[]>([]);
  const nativeQueueRef = useRef<Song[]>([]);
  const lastVisualizerUpdateRef = useRef(0);
  const persistedRefs = useRef<Record<string, string>>({});

  const persistCurrentSongId = useCallback(async (song: Song | null): Promise<void> => {
    if (!song || !songsRef.current.some(item => item.id === song.id)) {
      await storage.remove(StorageKeys.CURRENT_SONG_ID);
      return;
    }
    await storage.set(StorageKeys.CURRENT_SONG_ID, song.id);
  }, []);

  const playback = usePlaybackState();

  const isPlaying = playback.state === State.Playing;
  const isBuffering =
    playback.state === State.Buffering || playback.state === State.Loading;

  // ---- Setup + Hydration ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await setupTrackPlayer();

      const [
        storedSongs,
        storedPlaylists,
        storedEqEnabled,
        storedEqBands,
        storedEqPreset,
        storedVolume,
        storedRepeat,
        storedShuffle,
        storedCurrentSongId,
      ] = await Promise.all([
        storage.get<Song[]>(StorageKeys.SONGS),
        storage.get<Playlist[]>(StorageKeys.PLAYLISTS),
        storage.get<boolean>(StorageKeys.EQ_ENABLED),
        storage.get<number[]>(StorageKeys.EQ_BANDS),
        storage.get<EqPresetName | 'custom'>(StorageKeys.EQ_PRESET),
        storage.get<number>(StorageKeys.VOLUME),
        storage.get<RepeatMode>(StorageKeys.REPEAT_MODE),
        storage.get<boolean>(StorageKeys.SHUFFLE),
        storage.get<string>(StorageKeys.CURRENT_SONG_ID),
      ]);
      if (cancelled) return;
      if (storedSongs) {
        const sanitizedSongs = await sanitizeSongsForStorage(storedSongs);
        if (cancelled) return;
        songsRef.current = sanitizedSongs;
        setSongsState(sanitizedSongs);
        if (didSongCoversChange(sanitizedSongs, storedSongs)) {
          await storage.set(StorageKeys.SONGS, sanitizedSongs);
        }

        const {
          hydratedQueue,
          orderedQueue,
          restoredSong,
          shouldClearPersistedCurrentSongId,
        } = buildHydratedPlaybackQueue(sanitizedSongs, storedCurrentSongId, storedShuffle ?? false);

        baseQueueContextRef.current = hydratedQueue.slice();
        queueContextRef.current = orderedQueue;
        setPlaybackQueue(orderedQueue);

        if (shouldClearPersistedCurrentSongId) {
          await storage.remove(StorageKeys.CURRENT_SONG_ID);
        }

        if (restoredSong) {
          setCurrentSong(restoredSong);
          try {
            await TrackPlayer.reset();
            await TrackPlayer.add(orderedQueue.map(toTrackPlayerTrack));
            nativeQueueRef.current = orderedQueue.slice();
          } catch {
            // ignore hydration queue init failures
          }
        }
      }
      if (storedPlaylists) setPlaylists(storedPlaylists);
      if (storedEqEnabled != null) setEqEnabledState(storedEqEnabled);
      if (storedEqBands) setEqBandsState(storedEqBands);
      if (storedEqPreset) setEqPreset(storedEqPreset);
      if (storedVolume != null) {
        setVolumeState(storedVolume);
        TrackPlayer.setVolume(storedVolume).catch(() => undefined);
      }
      if (storedRepeat) {
        setRepeatMode(storedRepeat);
        TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(storedRepeat)).catch(() => undefined);
      }
      if (storedShuffle != null) setShuffle(storedShuffle);
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep "currentSong" in sync with active track
  useEffect(() => {
    const sub = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      async data => {
        const track = data.track;
        if (!track) return;
        const s =
          songsRef.current.find(x => x.id === track.id) ??
          queueContextRef.current.find(x => x.id === track.id) ??
          baseQueueContextRef.current.find(x => x.id === track.id);
        if (s) {
          setCurrentSong(s);
          await persistCurrentSongId(s);
        }
      },
    );
    return () => sub.remove();
  }, [persistCurrentSongId]);

  // ---- Native equalizer init ----
  useEffect(() => {
    let cancelled = false;
    SystemAudio.eqInit()
      .then(info => {
        if (!cancelled) setEqNative(info);
      })
      .catch(() => {
        if (!cancelled) setEqNative(null);
      });
    return () => {
      cancelled = true;
      SystemAudio.eqRelease();
    };
  }, []);

  // Apply native EQ enable + bands whenever they change. The 10 UI bands
  // are mapped onto the device's actual band count (typically 5) by
  // sampling the closest UI band for each native center frequency.
  useEffect(() => {
    if (!eqNative || !eqNative.available) return;
    SystemAudio.eqSetEnabled(eqEnabled);
  }, [eqEnabled, eqNative]);

  useEffect(() => {
    if (!eqNative || !eqNative.available) return;
    if (!eqEnabled) return;
    const nativeRange = [eqNative.minMillibel, eqNative.maxMillibel] as const;
    eqNative.bands.forEach(band => {
      const uiBandIndex = findClosestUiEqBandIndex(band.centerFreqHz);
      const dB = eqBands[uiBandIndex] ?? 0;
      const millibel = clampNativeEqMillibel(dbToMillibel(dB), nativeRange);
      SystemAudio.eqSetBandLevel(band.index, millibel);
    });
  }, [eqBands, eqEnabled, eqNative]);

  // ---- Visualizer ----
  useEffect(() => {
    const subFft = SystemAudio.onFft(data => {
      const now = Date.now();
      if (now - lastVisualizerUpdateRef.current < VISUALIZER_UPDATE_INTERVAL_MS) return;
      lastVisualizerUpdateRef.current = now;
      setFftBins(data);
    });
    const subState = SystemAudio.onVisualizerState(e => {
      setVisualizerRunning(e.running);
      setVisualizerError(e.running ? null : e.reason);
    });
    SystemAudio.visualizerStop();
    return () => {
      subFft.remove();
      subState.remove();
      SystemAudio.visualizerStop();
    };
  }, []);

  // Keep the native visualizer off during normal playback. It requires
  // RECORD_AUDIO and can overload older Android devices when combined with
  // heavy UI rendering. A future explicit visualizer toggle can start it.
  useEffect(() => {
    if (!isPlaying) SystemAudio.visualizerStop();
  }, [isPlaying]);

  // ---- Palette extraction for current track cover ----
  const currentArtworkUri = getSongArtworkUri(currentSong);

  useEffect(() => {
    let cancelled = false;
    if (!currentArtworkUri) {
      setPalette(null);
      return;
    }
    SystemAudio.extractPalette(currentArtworkUri)
      .then(p => {
        if (!cancelled) setPalette(p);
      })
      .catch(() => {
        if (!cancelled) setPalette(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentArtworkUri]);

  // Persist settings — but only AFTER hydration to avoid the initial state
  // (e.g. volume=1) overwriting persisted values from a previous session.
  const persistIfChanged = useCallback(
    async <T,>(key: string, value: T): Promise<void> => {
      const serialized = JSON.stringify(value);
      if (persistedRefs.current[key] === serialized) return;
      const stored = await storage.set(key, value);
      if (stored) persistedRefs.current[key] = serialized;
    },
    [],
  );

  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.VOLUME, volume);
  }, [volume, isReady, persistIfChanged]);
  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.SHUFFLE, shuffle);
  }, [shuffle, isReady, persistIfChanged]);
  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.REPEAT_MODE, repeatMode);
  }, [repeatMode, isReady, persistIfChanged]);
  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_ENABLED, eqEnabled);
  }, [eqEnabled, isReady, persistIfChanged]);
  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_BANDS, eqBands);
  }, [eqBands, isReady, persistIfChanged]);
  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.EQ_PRESET, eqPreset);
  }, [eqPreset, isReady, persistIfChanged]);
  useEffect(() => {
    if (!isReady) return;
    void persistIfChanged(StorageKeys.PLAYLISTS, playlists);
  }, [playlists, isReady, persistIfChanged]);
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const sanitizedSongs = await sanitizeSongsForStorage(songs);
      if (cancelled) return;
      if (didSongCoversChange(sanitizedSongs, songs)) {
        setSongsState(sanitizedSongs);
        return;
      }
      await persistIfChanged(StorageKeys.SONGS, sanitizedSongs);
    })();
    return () => {
      cancelled = true;
    };
  }, [songs, isReady, persistIfChanged]);

  // ---- Library ----
  const setSongs = useCallback((s: Song[]) => {
    const validSongIds = new Set(s.map(song => song.id));
    setPlaylists(prev => prunePlaylists(prev, validSongIds));
    setSongsState(s);
  }, []);

  const addSongs = useCallback((s: Song[]) => {
    setSongsState(prev => {
      const existing = new Set(prev.map(x => x.id));
      return [...prev, ...s.filter(x => !existing.has(x.id))];
    });
  }, []);

  const updateSongMetadata = useCallback((songId: string, patch: Partial<Song>) => {
    const patchSong = (song: Song): Song =>
      song.id === songId ? { ...song, ...patch } : song;
    setSongsState(prev => prev.map(patchSong));
    setCurrentSong(prev => (prev?.id === songId ? { ...prev, ...patch } : prev));
    setPlaybackQueue(prev => prev.map(patchSong));
    queueContextRef.current = queueContextRef.current.map(patchSong);
    baseQueueContextRef.current = baseQueueContextRef.current.map(patchSong);
    nativeQueueRef.current = nativeQueueRef.current.map(patchSong);

    const queueIndex = nativeQueueRef.current.findIndex(song => song.id === songId);
    const queuedPatchedSong =
      (queueIndex >= 0 ? nativeQueueRef.current[queueIndex] : undefined) ??
      baseQueueContextRef.current.find(song => song.id === songId);
    if (!queuedPatchedSong || queueIndex < 0) return;

    void TrackPlayer.updateMetadataForTrack(queueIndex, toTrackPlayerTrack(queuedPatchedSong)).catch(
      () => undefined,
    );
  }, []);
  // ---- Playback ----
  const persistRequestedSong = useCallback(async (requestedSong: Song): Promise<void> => {
    const isLibrarySong = songsRef.current.some(item => item.id === requestedSong.id);
    if (isLibrarySong) {
      await storage.set(StorageKeys.CURRENT_SONG_ID, requestedSong.id);
    } else {
      await storage.remove(StorageKeys.CURRENT_SONG_ID);
    }
  }, []);

  const playSong = useCallback(
    async (song: Song, queue?: Song[]) => {
      const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
      const plan = buildPlaySongQueuePlan(song, sourceQueue, nativeQueueRef.current);
      if (!plan) return;

      const { requestedSong, queueWithRequested, nativeIndex, canReuseNativeQueue } = plan;

      if (canReuseNativeQueue && trackPlayerWithSkip.skip) {
        const orderedQueue = plan.reusableOrderedQueue;
        queueContextRef.current = orderedQueue;
        baseQueueContextRef.current = nativeQueueRef.current.slice();
        setPlaybackQueue(orderedQueue);
        setCurrentSong(requestedSong);

        try {
          const activeTrack = await TrackPlayer.getActiveTrack();
          if (activeTrack?.id !== requestedSong.id) {
            await trackPlayerWithSkip.skip(nativeIndex);
          }
          await TrackPlayer.play();
          await persistRequestedSong(requestedSong);
          return;
        } catch {
          // Fall through to a full queue rebuild if native skip is unavailable/fails.
        }
      }

      const orderedQueue = plan.rebuildOrderedQueue;
      queueContextRef.current = orderedQueue;
      baseQueueContextRef.current = queueWithRequested.slice();
      nativeQueueRef.current = orderedQueue.slice();
      setPlaybackQueue(orderedQueue);

      setCurrentSong(requestedSong);
      await TrackPlayer.reset();
      await TrackPlayer.add(orderedQueue.map(toTrackPlayerTrack));
      await TrackPlayer.play();
      await persistRequestedSong(requestedSong);
    },
    [persistRequestedSong],
  );

  const togglePlayPause = useCallback(async () => {
    const state = (await TrackPlayer.getPlaybackState()).state;
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, []);

  const stop = useCallback(async () => {
    await TrackPlayer.stop();
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    await TrackPlayer.seekTo(millis / 1000);
  }, []);

  const next = useCallback(async () => {
    try {
      await TrackPlayer.skipToNext();
    } catch {
      /* end of queue */
    }
  }, []);
  const previous = useCallback(async () => {
    try {
      const { position } = await TrackPlayer.getProgress();
      if (position > 3) {
        await TrackPlayer.seekTo(0);
        return;
      }
      await TrackPlayer.skipToPrevious();
    } catch {
      try {
        await TrackPlayer.seekTo(0);
      } catch {
        /* at start */
      }
    }
  }, []);

  const toggleShuffle = useCallback(async () => {
    const currentQueue = (
      queueContextRef.current.length > 0
        ? queueContextRef.current
        : songsRef.current.filter(song => !!song.uri)
    ).slice();
    const current = await TrackPlayer.getActiveTrack();
    const currentId = current?.id ?? currentSong?.id;
    const plan = buildShuffleTogglePlan({
      currentQueue,
      baseQueue: baseQueueContextRef.current,
      currentSongId: currentId,
      shuffleEnabled: shuffle,
    });
    if (!plan) return;

    const { nextQueue, nextBaseQueue, selectedSong } = plan;
    queueContextRef.current = nextQueue.slice();
    baseQueueContextRef.current = nextBaseQueue.slice();
    setPlaybackQueue(nextQueue.slice());
    if (selectedSong) setCurrentSong(selectedSong);
    setShuffle(prev => !prev);

    try {
      const pos = await TrackPlayer.getProgress();
      await TrackPlayer.reset();
      await TrackPlayer.add(nextQueue.map(toTrackPlayerTrack));
      nativeQueueRef.current = nextQueue.slice();
      if (pos.position) await TrackPlayer.seekTo(pos.position);
      await TrackPlayer.play();
    } catch {
      /* ignore */
    }
  }, [currentSong?.id, shuffle]);

  const cycleRepeatMode = useCallback(async () => {
    const next: RepeatMode =
      repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    setRepeatMode(next);
    await TrackPlayer.setRepeatMode(toTrackPlayerRepeatMode(next));
  }, [repeatMode]);

  const setVolume = useCallback(async (v: number) => {
    const nextVolume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 1));
    setVolumeState(nextVolume);
    await TrackPlayer.setVolume(nextVolume);
  }, []);

  // ---- EQ (UI preset) ----
  const setEqBand = useCallback((i: number, v: number) => {
    setEqBandsState(prev => {
      const next = prev.slice();
      next[i] = v;
      return next;
    });
    setEqPreset('custom');
  }, []);
  const applyEqPreset = useCallback((p: EqPresetName) => {
    setEqBandsState(EQ_PRESETS[p].slice());
    setEqPreset(p);
  }, []);
  const setEqEnabled = useCallback((v: boolean) => setEqEnabledState(v), []);

  // ---- Playlists ----
  const createPlaylist = useCallback((name: string) => {
    const playlist: Playlist = {
      id: createPlaylistId(),
      name,
      songIds: [],
      createdAt: Date.now(),
    };
    setPlaylists(prev => [...prev, playlist]);
    return playlist;
  }, []);
  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => deletePlaylistById(prev, id));
  }, []);
  const renamePlaylist = useCallback((id: string, name: string) => {
    setPlaylists(prev => renamePlaylistById(prev, id, name));
  }, []);
  const addSongToPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(prev => addSongToPlaylistById(prev, playlistId, songId));
  }, []);
  const removeSongFromPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(prev => removeSongFromPlaylistById(prev, playlistId, songId));
  }, []);
  const playPlaylist = useCallback(
    async (playlistId: string) => {
      const p = playlists.find(x => x.id === playlistId);
      if (!p) return;
      const queue = p.songIds
        .map(id => songsRef.current.find(s => s.id === id))
        .filter((x): x is Song => !!x);
      if (queue.length > 0) await playSong(queue[0], queue);
    },
    [playlists, playSong],
  );

  const value = useMemo<MusicContextValue>(
    () => buildMusicContextValue({
      songs,
      setSongs,
      addSongs,
      updateSongMetadata,
      currentSong,
      playbackQueue,
      isPlaying,
      isBuffering,
      playSong,
      togglePlayPause,
      stop,
      seekTo,
      next,
      previous,
      shuffle,
      toggleShuffle,
      repeatMode,
      cycleRepeatMode,
      volume,
      setVolume,
      eqEnabled,
      setEqEnabled,
      eqBands,
      setEqBand,
      eqPreset,
      applyEqPreset,
      eqNative,
      fftBins,
      visualizerRunning,
      visualizerError,
      palette,
      playlists,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      playPlaylist,
      isReady,
    }),
    [
      songs,
      setSongs,
      addSongs,
      updateSongMetadata,
      currentSong,
      playbackQueue,
      isPlaying,
      isBuffering,
      playSong,
      togglePlayPause,
      stop,
      seekTo,
      next,
      previous,
      shuffle,
      toggleShuffle,
      repeatMode,
      cycleRepeatMode,
      volume,
      setVolume,
      eqEnabled,
      setEqEnabled,
      eqBands,
      setEqBand,
      eqPreset,
      applyEqPreset,
      eqNative,
      fftBins,
      visualizerRunning,
      visualizerError,
      palette,
      playlists,
      createPlaylist,
      deletePlaylist,
      renamePlaylist,
      addSongToPlaylist,
      removeSongFromPlaylist,
      playPlaylist,
      isReady,
    ],
  );

  const libraryValue = useMemo<LibraryMusicContextValue>(
    () => buildLibraryMusicContextValue(value),
    [value],
  );

  const miniPlayerValue = useMemo<MiniPlayerMusicContextValue>(
    () => buildMiniPlayerMusicContextValue(value),
    [value],
  );

  const nowPlayingValue = useMemo<NowPlayingMusicContextValue>(
    () => buildNowPlayingMusicContextValue(value),
    [value],
  );

  return (
    <MusicContext.Provider value={value}>
      <LibraryMusicContext.Provider value={libraryValue}>
        <MiniPlayerMusicContext.Provider value={miniPlayerValue}>
          <NowPlayingMusicContext.Provider value={nowPlayingValue}>
            {children}
          </NowPlayingMusicContext.Provider>
        </MiniPlayerMusicContext.Provider>
      </LibraryMusicContext.Provider>
    </MusicContext.Provider>
  );
};

export const useMusicContext = createRequiredContextHook(
  MusicContext,
  'useMusicContext',
  'MusicProvider',
);

export const useLibraryMusicContext = createRequiredContextHook(
  LibraryMusicContext,
  'useLibraryMusicContext',
  'MusicProvider',
);

export const useMiniPlayerMusicContext = createRequiredContextHook(
  MiniPlayerMusicContext,
  'useMiniPlayerMusicContext',
  'MusicProvider',
);

export const useNowPlayingMusicContext = createRequiredContextHook(
  NowPlayingMusicContext,
  'useNowPlayingMusicContext',
  'MusicProvider',
);