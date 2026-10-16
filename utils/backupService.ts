import type { Song } from '../types/Song';
import { storage } from './storage';
import { BACKUP_SETTING_KEYS, backupSettingsSchema, validateMusicBackup, type BackupSettings, type MusicBackup } from './backupFormat';
import { mapBackupSongs, mergeBackupCollection, toBackupSongReference, type ManualBackupMapping } from './backupMapping';
import { commitBackupRestore } from './backupTransaction';
import { normalizeNowPlayingPlayerLayout } from './nowPlayingControlsMode';
import { normalizePlayerPresentation } from './playerPresentation';
import { flushPersistenceOwners, waitForPersistenceWork } from './persistenceMaintenance';
import { publishFavoriteSongIds } from './favoriteSongState';

const defaultSettings: BackupSettings = {
  appAppearance: 'dark', appThemeSkin: 'graphite', coverBassPulse: true, nowPlayingPlayerLayout: 'classic',
  librarySortMode: 'alphabet', librarySongViewMode: 'list', albumViewMode: 'grid', volume: 1,
  repeatMode: 'off', shuffle: false, eqEnabled: false, eqPreset: 'flat', eqBands: Array(10).fill(0),
  playerPresentationV3: normalizePlayerPresentation(null), playbackResumeEnabled: false,
};
const readBackupSettings = async (): Promise<BackupSettings> => {
  const settings = { ...defaultSettings } as Record<string, unknown>;
  for (const key of BACKUP_SETTING_KEYS) {
    const value = await storage.get(key);
    if (value !== null) settings[key] = value;
  }
  const layout = await storage.get('nowPlayingPlayerLayout') ?? await storage.get('nowPlayingControlsMode');
  settings.nowPlayingPlayerLayout = normalizeNowPlayingPlayerLayout(layout);
  settings.playerPresentationV3 = normalizePlayerPresentation(settings.playerPresentationV3);
  return backupSettingsSchema.parse(settings);
};
export const createMusicBackup = async (): Promise<MusicBackup> => {
  flushPersistenceOwners();
  await waitForPersistenceWork();
  const [songs, playlists, favorites, settings] = await Promise.all([
    storage.getSongs(), storage.getPlaylists(), storage.getFavoriteSongIds(), readBackupSettings(),
  ]);
  const wanted = new Set([...favorites, ...playlists.flatMap(playlist => playlist.songIds)]);
  const byId = new Map(songs.map(song => [song.id, song]));
  const references = [...wanted].map(id => {
    const song = byId.get(id);
    return song ? toBackupSongReference(song) : { id, title: 'Fehlende Quelle', artist: '' };
  });
  return validateMusicBackup({ format: 'k1w1-musik-backup', version: 1, createdAt: Date.now(),
    songs: references, playlists, favorites, settings });
};
export interface RestoreBackupRequest {
  backup: MusicBackup;
  manual: ManualBackupMapping;
  applySettings: boolean;
  // Re-check the exact preview library before journalling. A changed source
  // requires a new preview, even when its title and ID still look the same.
  previewSources: string;
}
export const backupLibrarySignature = (songs: Song[]): string => JSON.stringify(songs.map(toBackupSongReference));
export const restoreMusicBackup = async (request: RestoreBackupRequest) => {
  const backup = validateMusicBackup(request.backup);
  const [songs, playlists, favorites] = await Promise.all([
    storage.getSongs(), storage.getPlaylists(), storage.getFavoriteSongIds(),
  ]);
  if (backupLibrarySignature(songs) !== request.previewSources) {
    throw new Error('Die Sammlung hat sich seit der Vorschau geändert. Bitte prüfe das Backup erneut.');
  }
  const matches = mapBackupSongs(backup, songs, request.manual);
  const references = new Set(backup.songs.map(song => song.id));
  const targets = new Set(songs.map(song => song.id));
  for (const [id, target] of Object.entries(request.manual)) {
    if (!references.has(id) || (target !== null && !targets.has(target))) {
      throw new Error('Eine manuelle Zuordnung ist nicht mehr gültig. Bitte Vorschau erneut öffnen.');
    }
  }
  const merged = mergeBackupCollection(backup, matches, playlists, favorites);
  await commitBackupRestore({ playlists: merged.playlists, favoriteSongIds: merged.favorites,
    legacySongFavoritesMigrationCompleted: true, ...(request.applySettings ? backup.settings : {}) });
  publishFavoriteSongIds(merged.favorites);
  return `${merged.addedPlaylists} Playlists und ${merged.addedFavorites} Favoriten ergänzt. ${merged.skippedSongs} nicht zugeordnete Titel übersprungen.`;
};
