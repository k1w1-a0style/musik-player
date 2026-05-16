import type { Song } from '../types/Song';

export const DEMO_SONGS: Song[] = [
  { id: 'demo-1', title: 'SoundHelix Song 1', artist: 'SoundHelix', album: 'Demo', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 'demo-2', title: 'SoundHelix Song 2', artist: 'SoundHelix', album: 'Demo', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 'demo-3', title: 'SoundHelix Song 3', artist: 'SoundHelix', album: 'Demo', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
];

export const isDemoSong = (song: Song): boolean => song.id.startsWith('demo-');

export const shouldUseDemoSongs = (
  isDev: boolean,
  nodeEnv: string | undefined,
  isReady: boolean,
  songCount: number,
): boolean => isDev && nodeEnv !== 'test' && isReady && songCount === 0;

export const getLibraryDisplaySongs = (
  songs: Song[],
  isReady: boolean,
  isDev: boolean,
  nodeEnv: string | undefined,
): Song[] => (shouldUseDemoSongs(isDev, nodeEnv, isReady, songs.length) ? DEMO_SONGS : songs);
