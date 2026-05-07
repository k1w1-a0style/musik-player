import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  RepeatMode as RNTPRepeatMode,
  State,
  usePlaybackState,
  useProgress,
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
import SystemAudio, {
  type EqInitResult,
  type PaletteResult,
} from 'expo-system-audio';

interface MusicContextValue {
  // Library
  songs: Song[];
  setSongs: (s: Song[]) => void;
  addSongs: (s: Song[]) => void;

  // Playback
  currentSong: Song | null;
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  playSong: (song: Song, queue?: Song[]) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;

  // Queue / modes
  shuffle: boolean;
  toggleShuffle: () => Promise<void>;
  repeatMode: RepeatMode;
  cycleRepeatMode: () => Promise<void>;

  // Volume
  volume: number;
  setVolume: (v: number) => Promise<void>;

  // EQ (UI-only, persisted as preset)
  eqEnabled: boolean;
  setEqEnabled: (v: boolean) => void;
  eqBands: number[];
  setEqBand: (i: number, v: number) => void;
  eqPreset: EqPresetName | 'custom';
  applyEqPreset: (p: EqPresetName) => void;
  /** Native equalizer info — null while unsupported / loading */
  eqNative: EqInitResult | null;

  // Visualizer
  fftBins: number[];
  visualizerRunning: boolean;
  visualizerError: string | null;

  // Album palette of the currently playing track
  palette: PaletteResult | null;

  // Playlists
  playlists: Playlist[];
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  playPlaylist: (playlistId: string) => Promise<void>;

  // Lifecycle
  isReady: boolean;
}

const MusicContext = createContext<MusicContextValue | null>(null);

const toTrack = (s: Song) => ({
  id: s.id,
  url: s.uri ?? '',
  title: s.title,
  artist: s.artist,
  album: s.album,
  artwork: s.cover,
  duration: s.duration ? s.duration / 1000 : undefined,
});

export const MusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  const [songs, setSongsState] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [volume, setVolumeState] = useState(1);

  const [eqEnabled, setEqEnabledState] = useState(false);
  const [eqBands, setEqBandsState] = useState<number[]>(EQ_PRESETS.flat.slice());
  const [eqPreset, setEqPreset] = useState<EqPresetName | 'custom'>('flat');
  const [eqNative, setEqNative] = useState<EqInitResult | null>(null);

  // Visualizer + palette
  const [fftBins, setFftBins] = useState<number[]>(() => new Array(16).fill(0));
  const [visualizerRunning, setVisualizerRunning] = useState(false);
  const [visualizerError, setVisualizerError] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteResult | null>(null);

  const songsRef = useRef(songs);
  songsRef.current = songs;
  const queueContextRef = useRef<Song[]>([]);
  const baseQueueContextRef = useRef<Song[]>([]);

  const playback = usePlaybackState();
  const progress = useProgress(500);

  const isPlaying = playback.state === State.Playing;
  const isBuffering =
    playback.state === State.Buffering || playback.state === State.Loading;

  // ---- Setup + Hydration ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await TrackPlayer.setupPlayer({ autoHandleInterruptions: true });
        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
          },
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            Capability.Stop,
          ],
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
          ],
          notificationCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
          ],
          progressUpdateEventInterval: 2,
        });
      } catch {
        // Already set up
      }

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
        setSongsState(sanitizedSongs);
        const changed = sanitizedSongs.some((song, index) => song.cover !== storedSongs[index]?.cover);
        if (changed) await storage.set(StorageKeys.SONGS, sanitizedSongs);

        const hydratedQueue = sanitizedSongs.filter(song => !!song.uri);
        queueContextRef.current = hydratedQueue;
        baseQueueContextRef.current = hydratedQueue;

        if (storedCurrentSongId) {
          const restoredSong = sanitizedSongs.find(song => song.id === storedCurrentSongId);
          if (restoredSong) {
            setCurrentSong(restoredSong);
            const idx = hydratedQueue.findIndex(song => song.id === restoredSong.id);
            const orderedQueue = idx >= 0
              ? [...hydratedQueue.slice(idx), ...hydratedQueue.slice(0, idx)]
              : [restoredSong, ...hydratedQueue.filter(song => song.id !== restoredSong.id)];
            try {
              await TrackPlayer.reset();
              await TrackPlayer.add(orderedQueue.map(toTrack));
            } catch {
              // ignore hydration queue init failures
            }
          } else {
            await storage.remove(StorageKeys.CURRENT_SONG_ID);
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
      if (storedRepeat) setRepeatMode(storedRepeat);
      if (storedShuffle != null) setShuffle(storedShuffle);
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep "currentSong" in sync with active track
  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async data => {
      const track = data.track;
      if (!track) return;
      const s = songsRef.current.find(x => x.id === track.id);
      if (s) setCurrentSong(s);
    });
    return () => sub.remove();
  }, []);

  // ---- Native equalizer init ----
  useEffect(() => {
    let cancelled = false;
    SystemAudio.eqInit().then(info => {
      if (!cancelled) setEqNative(info);
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
    const UI_FREQS = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    eqNative.bands.forEach(band => {
      // Find the closest UI band by center freq
      let bestIdx = 0;
      let bestDist = Infinity;
      UI_FREQS.forEach((f, i) => {
        const d = Math.abs(f - band.centerFreqHz);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      const dB = eqBands[bestIdx] ?? 0;
      const millibel = Math.round(dB * 100); // 1 dB = 100 mB
      SystemAudio.eqSetBandLevel(band.index, millibel);
    });
  }, [eqBands, eqEnabled, eqNative]);

  // ---- Visualizer ----
  useEffect(() => {
    const subFft = SystemAudio.onFft(data => setFftBins(data));
    const subState = SystemAudio.onVisualizerState(e => {
      setVisualizerRunning(e.running);
      setVisualizerError(e.running ? null : e.reason);
    });
    return () => {
      subFft.remove();
      subState.remove();
      SystemAudio.visualizerStop();
    };
  }, []);

  // Start/stop visualizer with playback
  useEffect(() => {
    const syncVisualizer = async (): Promise<void> => {
      if (!isPlaying) {
        SystemAudio.visualizerStop();
        return;
      }
      if (Platform.OS === 'android') {
        const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
        let granted = await PermissionsAndroid.check(permission);
        if (!granted) {
          const requestResult = await PermissionsAndroid.request(permission, {
            title: 'Mikrofon-Berechtigung',
            message: 'Für den Audio-Visualizer wird RECORD_AUDIO benötigt.',
            buttonPositive: 'Erlauben',
            buttonNegative: 'Ablehnen',
          });
          granted = requestResult === PermissionsAndroid.RESULTS.GRANTED;
        }
        if (!granted) return;
      }
      SystemAudio.visualizerStart(16);
    };
    syncVisualizer();
  }, [isPlaying]);

  // ---- Palette extraction for current track cover ----
  useEffect(() => {
    let cancelled = false;
    if (!currentSong?.cover) {
      setPalette(null);
      return;
    }
    SystemAudio.extractPalette(currentSong.cover).then(p => {
      if (!cancelled) setPalette(p);
    });
    return () => {
      cancelled = true;
    };
  }, [currentSong?.cover]);


  // Persist settings — but only AFTER hydration to avoid the initial state
  // (e.g. volume=1) overwriting persisted values from a previous session.
  useEffect(() => {
    if (!isReady) return;
    storage.set(StorageKeys.VOLUME, volume);
  }, [volume, isReady]);
  useEffect(() => {
    if (!isReady) return;
    storage.set(StorageKeys.SHUFFLE, shuffle);
  }, [shuffle, isReady]);
  useEffect(() => {
    if (!isReady) return;
    storage.set(StorageKeys.REPEAT_MODE, repeatMode);
  }, [repeatMode, isReady]);
  useEffect(() => {
    if (!isReady) return;
    storage.set(StorageKeys.EQ_ENABLED, eqEnabled);
  }, [eqEnabled, isReady]);
  useEffect(() => {
    if (!isReady) return;
    storage.set(StorageKeys.EQ_BANDS, eqBands);
  }, [eqBands, isReady]);
  useEffect(() => {
    if (!isReady) return;
    storage.set(StorageKeys.EQ_PRESET, eqPreset);
  }, [eqPreset, isReady]);
  useEffect(() => {
    if (!isReady) return;
    storage.set(StorageKeys.PLAYLISTS, playlists);
  }, [playlists, isReady]);
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    (async () => {
      const sanitizedSongs = await sanitizeSongsForStorage(songs);
      if (cancelled) return;
      const changed = sanitizedSongs.some((song, index) => song.cover !== songs[index]?.cover);
      if (changed) {
        setSongsState(sanitizedSongs);
        return;
      }
      await storage.set(StorageKeys.SONGS, sanitizedSongs);
    })();
    return () => {
      cancelled = true;
    };
  }, [songs, isReady]);

  // ---- Library ----
  const setSongs = useCallback((s: Song[]) => setSongsState(s), []);
  const addSongs = useCallback((s: Song[]) => {
    setSongsState(prev => {
      const existing = new Set(prev.map(x => x.id));
      return [...prev, ...s.filter(x => !existing.has(x.id))];
    });
  }, []);

  // ---- Playback ----
  const playSong = useCallback(async (song: Song, queue?: Song[]) => {
    const sourceQueue = queue && queue.length > 0 ? queue : songsRef.current;
    const contextQueue = sourceQueue.filter(x => !!x.uri);
    if (contextQueue.length === 0) return;

    const idx = contextQueue.findIndex(x => x.id === song.id);
    const orderedQueue = idx >= 0
      ? [...contextQueue.slice(idx), ...contextQueue.slice(0, idx)]
      : [song, ...contextQueue.filter(x => x.id !== song.id)];

    queueContextRef.current = orderedQueue;
    baseQueueContextRef.current = contextQueue.slice();

    await TrackPlayer.reset();
    await TrackPlayer.add(orderedQueue.map(toTrack));
    setCurrentSong(song);
    await TrackPlayer.play();
    await storage.set(StorageKeys.CURRENT_SONG_ID, song.id);
  }, []);

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
      await TrackPlayer.skipToPrevious();
    } catch {
      /* at start */
    }
  }, []);

  const toggleShuffle = useCallback(async () => {
    const currentQueue = (queueContextRef.current.length > 0
      ? queueContextRef.current
      : songsRef.current.filter(song => !!song.uri)).slice();
    if (currentQueue.length === 0) return;

    const current = await TrackPlayer.getActiveTrack();
    const currentId = current?.id ?? currentSong?.id;

    let list = currentQueue.slice();
    if (!shuffle) {
      if (baseQueueContextRef.current.length === 0) {
        baseQueueContextRef.current = currentQueue.slice();
      }
      const currentTrack = currentId ? list.find(song => song.id === currentId) : undefined;
      const rest = list.filter(song => song.id !== currentId);
      for (let i = rest.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      list = currentTrack ? [currentTrack, ...rest] : rest;
    } else {
      const baseQueue = baseQueueContextRef.current.length > 0 ? baseQueueContextRef.current : currentQueue;
      if (currentId) {
        const curIdx = baseQueue.findIndex(song => song.id === currentId);
        list = curIdx >= 0
          ? [...baseQueue.slice(curIdx), ...baseQueue.slice(0, curIdx)]
          : baseQueue.slice();
      } else {
        list = baseQueue.slice();
      }
    }

    if (list.length === 0) return;
    queueContextRef.current = list.slice();
    setShuffle(prev => !prev);

    try {
      const pos = await TrackPlayer.getProgress();
      await TrackPlayer.reset();
      await TrackPlayer.add(list.map(toTrack));
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
    await TrackPlayer.setRepeatMode(
      next === 'off'
        ? RNTPRepeatMode.Off
        : next === 'one'
          ? RNTPRepeatMode.Track
          : RNTPRepeatMode.Queue,
    );
  }, [repeatMode]);

  const setVolume = useCallback(async (v: number) => {
    setVolumeState(v);
    await TrackPlayer.setVolume(v);
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
      id: `pl-${Date.now()}`,
      name,
      songIds: [],
      createdAt: Date.now(),
    };
    setPlaylists(prev => [...prev, playlist]);
    return playlist;
  }, []);
  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);
  const renamePlaylist = useCallback((id: string, name: string) => {
    setPlaylists(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  }, []);
  const addSongToPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(prev =>
      prev.map(p =>
        p.id === playlistId && !p.songIds.includes(songId)
          ? { ...p, songIds: [...p.songIds, songId] }
          : p,
      ),
    );
  }, []);
  const removeSongFromPlaylist = useCallback((playlistId: string, songId: string) => {
    setPlaylists(prev =>
      prev.map(p =>
        p.id === playlistId ? { ...p, songIds: p.songIds.filter(s => s !== songId) } : p,
      ),
    );
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
    () => ({
      songs,
      setSongs,
      addSongs,
      currentSong,
      isPlaying,
      isBuffering,
      position: progress.position * 1000,
      duration: progress.duration * 1000,
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
      currentSong,
      isPlaying,
      isBuffering,
      progress.position,
      progress.duration,
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

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};

export const useMusicContext = (): MusicContextValue => {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error('useMusicContext must be used within a MusicProvider');
  }
  return ctx;
};
