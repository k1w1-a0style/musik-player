import AsyncStorage from '@react-native-async-storage/async-storage';
import { storage } from '../storage';
import { backupLibrarySignature, createMusicBackup, restoreMusicBackup } from '../backupService';
import type { MusicBackup } from '../backupFormat';
import type { Song } from '../../types/Song';
import { toBackupSongReference } from '../backupMapping';
import { getPublishedFavoriteSongIds } from '../favoriteSongState';

const song: Song = { id: 'a', title: 'Für Änne', artist: 'Artist', uri: 'file:///A.mp3',
  fileInfo: { uri: 'file:///A.mp3', size: 1000, modificationTime: 1700000000000 } };
const backup: MusicBackup = { format: 'k1w1-musik-backup', version: 1, createdAt: 1, songs: [toBackupSongReference(song)],
  favorites: ['a'], playlists: [{ id: 'p', name: 'Mix', songIds: ['a'], createdAt: 1, updatedAt: 2 }],
  settings: { appThemeSkin: 'minimal', eqPreset: 'custom', eqBands: Array(10).fill(3) } };
beforeEach(async () => { await AsyncStorage.clear(); });
test('export captures confirmed data, effective defaults and current custom EQ but no audio payloads', async () => {
  await storage.setSongs([song]); await storage.setPlaylists(backup.playlists); await storage.setFavoriteSongIds(['a']);
  await storage.setEqPreset('custom'); await storage.setEqBands(Array(10).fill(2));
  const exported = await createMusicBackup();
  expect(exported.songs).toEqual([toBackupSongReference(song)]);
  expect(exported.settings).toMatchObject({ appThemeSkin: 'graphite', playbackResumeEnabled: false,
    eqPreset: 'custom', eqBands: Array(10).fill(2) });
});
test('fresh installation can inspect and restore lists while missing songs remain explicitly absent', async () => {
  const result = await restoreMusicBackup({ backup, manual: {}, applySettings: true, previewSources: backupLibrarySignature([]) });
  expect(result).toContain('1 nicht zugeordnete');
  expect(await storage.getPlaylists()).toEqual([expect.objectContaining({ name: 'Mix', songIds: [] })]);
  expect(await storage.getFavoriteSongIds()).toEqual([]);
  expect(await storage.get('appThemeSkin')).toBe('minimal');
  expect(await storage.getEqBands()).toEqual(Array(10).fill(3));
});
test('restore merges into the confirmed current collection, preserves old list identity and settings unless selected', async () => {
  await storage.setSongs([song]);
  await storage.setPlaylists([{ id: 'existing', name: 'Mix', songIds: ['a'], createdAt: 4, updatedAt: 4 }]);
  await storage.set('appThemeSkin', 'graphite');
  const signature = backupLibrarySignature(await storage.getSongs());
  await restoreMusicBackup({ backup, manual: {}, applySettings: false, previewSources: signature });
  expect((await storage.getPlaylists()).map(playlist => playlist.name)).toEqual(['Mix', 'Mix (Backup)']);
  expect((await storage.getPlaylists())[0].id).toBe('existing');
  expect(await storage.getFavoriteSongIds()).toEqual(['a']);
  expect(getPublishedFavoriteSongIds()).toEqual(['a']);
  expect(await storage.get('appThemeSkin')).toBe('graphite');
  expect(await storage.getSongs()).toEqual([song]);
});
test('stale preview and vanished manual targets fail before journal creation', async () => {
  await storage.setSongs([song]);
  const set = jest.spyOn(AsyncStorage, 'setItem'); set.mockClear();
  await expect(restoreMusicBackup({ backup, manual: {}, applySettings: true,
    previewSources: backupLibrarySignature([]) })).rejects.toThrow('geändert');
  await expect(restoreMusicBackup({ backup, manual: { a: 'vanished' }, applySettings: true,
    previewSources: backupLibrarySignature([song]) })).rejects.toThrow('nicht mehr gültig');
  expect(set).not.toHaveBeenCalled();
});
test('export preserves missing reference identity but labels it as a missing source rather than a song title', async () => {
 await storage.setFavoriteSongIds(['missing-id']);
 const exported = await createMusicBackup();
 expect(exported.songs).toEqual([{id:'missing-id',title:'Fehlende Quelle',artist:''}]);
 expect(exported.favorites).toEqual(['missing-id']);
});
