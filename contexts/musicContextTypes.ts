import type { EqInitResult, PaletteResult } from 'expo-system-audio';
import type { EqPresetName, Playlist, RepeatMode, Song } from '../types/Song';
import type { SongMetadataPatchesById } from './useLibraryActions';
import type { NativeQueueActionResult } from './playbackQueueActionHelpers';

export type PlaylistSongMoveDirection = 'up' | 'down';

export interface MusicContextValue {
  hydrationStatus?: 'loading' | 'ready' | 'degraded' | 'retry-required';
  retryHydration?: () => void;
  songs: Song[];
  setSongs: (s: Song[]) => void;
  addSongs: (s: Song[]) => void;
  updateSongMetadata: (songId: string, patch: Partial<Song>) => void;
  applySongMetadataPatches: (patchesBySongId: SongMetadataPatchesById) => void;
  currentSong: Song | null;
  playbackQueue: Song[];
  isPlaying: boolean;
  isBuffering: boolean;
  playSong: (song: Song, queue?: Song[]) => Promise<NativeQueueActionResult>;
  playSongNext: (song: Song) => Promise<NativeQueueActionResult>;
  addSongToQueue: (song: Song) => Promise<NativeQueueActionResult>;
  reorderQueue?: (fromIndex: number, toIndex: number) => Promise<NativeQueueActionResult>;
  togglePlayPause: () => Promise<void>;
  stop: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  shuffle: boolean;
  toggleShuffle: () => Promise<NativeQueueActionResult>;
  repeatMode: RepeatMode;
  cycleRepeatMode: () => Promise<void>;
  volume: number;
  setVolume: (v: number) => Promise<void>;
  eqEnabled: boolean;
  setEqEnabled: (v: boolean) => void;
  eqBands: number[];
  setEqBand: (i: number, v: number) => void;
  eqPreset: EqPresetName | 'custom';
  applyEqPreset: (p: EqPresetName) => void;
  eqNative: EqInitResult | null;
  palette: PaletteResult | null;
  paletteLoading?: boolean;
  playlists: Playlist[];
  createPlaylist: (name: string) => Playlist;
  saveQueueAsPlaylist: (name: string, queue: Song[]) => Playlist | null;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  moveSongInPlaylist?: (playlistId: string, songId: string, direction: PlaylistSongMoveDirection) => void;
  playPlaylist: (playlistId: string) => Promise<void>;
  isReady: boolean;
}

export interface LibraryMusicContextValue {
  hydrationStatus?: 'loading' | 'ready' | 'degraded' | 'retry-required';
  retryHydration?: () => void;
  songs: Song[];
  setSongs: (s: Song[]) => void;
  currentSong: Song | null;
  playSong: (song: Song, queue?: Song[]) => Promise<NativeQueueActionResult>;
  playSongNext: (song: Song) => Promise<NativeQueueActionResult>;
  addSongToQueue: (song: Song) => Promise<NativeQueueActionResult>;
  isReady: boolean;
  isPlaying: boolean;
  updateSongMetadata: (songId: string, patch: Partial<Song>) => void;
  applySongMetadataPatches: (patchesBySongId: SongMetadataPatchesById) => void;
  playlists: Playlist[];
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  moveSongInPlaylist?: (playlistId: string, songId: string, direction: PlaylistSongMoveDirection) => void;
  playPlaylist: (playlistId: string) => Promise<void>;
}

export interface MiniPlayerMusicContextValue {
  hydrationStatus?: 'loading' | 'ready' | 'degraded' | 'retry-required';
  retryHydration?: () => void;
  currentSong: Song | null;
  isPlaying: boolean;
  togglePlayPause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
}

export interface NowPlayingMusicContextValue {
  hydrationStatus?: 'loading' | 'ready' | 'degraded' | 'retry-required';
  retryHydration?: () => void;
  playbackQueue: Song[];
  currentSong: Song | null;
  seekTo: (millis: number) => Promise<void>;
  isPlaying: boolean;
  togglePlayPause: () => Promise<void>;
  sleepTimerActive: boolean;
  sleepTimerRemainingSeconds: number | null;
  startSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  volume: number;
  setVolume: (v: number) => Promise<void>;
  palette: PaletteResult | null;
  paletteLoading?: boolean;
  playSong: (song: Song, queue?: Song[]) => Promise<NativeQueueActionResult>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  reorderQueue?: (fromIndex: number, toIndex: number) => Promise<NativeQueueActionResult>;
  saveQueueAsPlaylist: (name: string, queue: Song[]) => Playlist | null;
  shuffle: boolean;
  toggleShuffle: () => Promise<NativeQueueActionResult>;
  repeatMode: RepeatMode;
  cycleRepeatMode: () => Promise<void>;
  canSkip: boolean;
}
