export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  uri?: string;
  cover?: string;
  duration?: number;
  year?: string;
  genre?: string;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
  createdAt: number;
}

export type RepeatMode = 'off' | 'one' | 'all';

export const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock: [5, 3, -2, -3, -1, 2, 4, 6, 6, 5],
  pop: [-1, 2, 4, 5, 3, -1, -2, -2, -1, -1],
  jazz: [4, 3, 1, 2, -2, -2, 0, 1, 2, 3],
  bassBoost: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  vocal: [-2, -3, -3, 1, 4, 4, 3, 1, -1, -2],
  electronic: [4, 3, 1, 0, -2, 2, 1, 1, 4, 5],
} as const;

export type EqPresetName = keyof typeof EQ_PRESETS;

export const EQ_BAND_LABELS = ['60', '170', '310', '600', '1K', '3K', '6K', '12K', '14K', '16K'];
