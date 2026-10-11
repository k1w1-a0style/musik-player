import { z } from 'zod';

export const MAX_BACKUP_CODE_UNITS = 4 * 1024 * 1024;
const id = z.string().min(1).max(512).refine(value => value === value.trim());
const text = z.string().max(512);
const timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);
export const backupSettingsSchema = z.object({
  appAppearance: z.enum(['dark', 'light']).optional(),
  appThemeSkin: z.enum(['graphite', 'minimal', 'neon-cover']).optional(),
  coverBassPulse: z.boolean().optional(),
  nowPlayingPlayerLayout: z.enum(['classic', 'soundcloud']).optional(),
  librarySortMode: z.enum(['alphabet', 'trackNumber', 'year', 'recentlyAdded']).optional(),
  librarySongViewMode: z.enum(['list', 'gridLarge', 'gridSmall', 'banner']).optional(),
  albumViewMode: z.enum(['grid', 'list']).optional(),
  volume: z.number().finite().min(0).max(1).optional(),
  repeatMode: z.enum(['off', 'one', 'all']).optional(),
  shuffle: z.boolean().optional(),
  eqEnabled: z.boolean().optional(),
  eqPreset: z.enum(['flat', 'rock', 'pop', 'jazz', 'bassBoost', 'vocal', 'electronic', 'custom']).optional(),
  eqBands: z.array(z.number().finite().min(-12).max(12)).length(10).optional(),
  playerPresentationV3: z.object({ quiet: z.boolean(), density: z.enum(['standard', 'compact']),
    waveformAccent: z.enum(['cover', 'neutral', 'orange', 'blue']) }).strict().optional(),
  playbackResumeEnabled: z.boolean().optional(),
}).strict();
export type BackupSettings = z.infer<typeof backupSettingsSchema>;
export const BACKUP_SETTING_KEYS = Object.keys(backupSettingsSchema.shape) as (keyof BackupSettings)[];
const songReferenceSchema = z.object({
  id, title: text, artist: text,
  uri: z.string().max(4096).optional(),
  size: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  modificationTime: timestamp.optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
}).strict();
const backupSchema = z.object({
  format: z.literal('k1w1-musik-backup'), version: z.literal(1), createdAt: timestamp,
  songs: z.array(songReferenceSchema).max(20000),
  favorites: z.array(id).max(20000),
  playlists: z.array(z.object({ id, name: z.string().min(1).max(512), songIds: z.array(id).max(20000),
    createdAt: timestamp, updatedAt: timestamp }).strict()).max(2000),
  settings: backupSettingsSchema,
}).strict();
export type MusicBackup = z.infer<typeof backupSchema>;
export type BackupSongReference = MusicBackup['songs'][number];

export const validateMusicBackup = (value: unknown): MusicBackup => {
  const parsed = backupSchema.safeParse(value);
  if (!parsed.success) throw new Error('Ungültiges Backup oder nicht unterstützte Formatversion.');
  const backup = parsed.data;
  const refs = new Set(backup.songs.map(song => song.id));
  const playlistIds = new Set(backup.playlists.map(playlist => playlist.id));
  const occurrences = backup.playlists.reduce((sum, playlist) => sum + playlist.songIds.length, 0);
  if (refs.size !== backup.songs.length || playlistIds.size !== backup.playlists.length || occurrences > 100000
    || new Set(backup.favorites).size !== backup.favorites.length
    || backup.playlists.some(playlist => new Set(playlist.songIds).size !== playlist.songIds.length)
    || [...backup.favorites, ...backup.playlists.flatMap(playlist => playlist.songIds)].some(songId => !refs.has(songId))) {
    throw new Error('Das Backup enthält doppelte IDs, ungültige Verknüpfungen oder zu viele Einträge.');
  }
  return backup;
};
export const parseMusicBackup = (raw: string): MusicBackup => {
  if (raw.length > MAX_BACKUP_CODE_UNITS) throw new Error('Das Backup ist zu groß (maximal 4 Millionen Zeichen).');
  try { return validateMusicBackup(JSON.parse(raw)); }
  catch (error) { throw error instanceof SyntaxError ? new Error('Die Backupdatei ist kein gültiges JSON.') : error; }
};
export const serializeMusicBackup = (backup: MusicBackup): string => {
  const raw = JSON.stringify(validateMusicBackup(backup));
  if (raw.length > MAX_BACKUP_CODE_UNITS) throw new Error('Das Backup überschreitet das sichere Größenlimit.');
  return raw;
};
