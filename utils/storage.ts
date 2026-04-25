import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@musikplayer:';

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

export const StorageKeys = {
  SONGS: 'songs',
  PLAYLISTS: 'playlists',
  CURRENT_SONG_ID: 'currentSongId',
  EQ_PRESET: 'eqPreset',
  EQ_BANDS: 'eqBands',
  EQ_ENABLED: 'eqEnabled',
  VOLUME: 'volume',
  REPEAT_MODE: 'repeatMode',
  SHUFFLE: 'shuffle',
} as const;
