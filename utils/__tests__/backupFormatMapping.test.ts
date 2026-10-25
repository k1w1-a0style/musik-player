import type { Song } from '../../types/Song';
import { MAX_BACKUP_CODE_UNITS, parseMusicBackup, serializeMusicBackup, type MusicBackup } from '../backupFormat';
import { mapBackupSongs, mergeBackupCollection, toBackupSongReference } from '../backupMapping';

const song = (id: string, uri: string, revision = 1700000000000): Song => ({ id, uri, title: 'Größte Hits 🎵', artist: 'Änne',
  fileInfo: { uri, size: 1024, modificationTime: revision } });
const a = song('a', 'content://provider/document/Case%2FSong');
const fixture = (songs: Song[] = [a]): MusicBackup => ({ format: 'k1w1-musik-backup', version: 1, createdAt: 1700000000000,
  songs: songs.map(toBackupSongReference), favorites: songs.map(item => item.id), settings: { eqPreset: 'custom', eqBands: Array(10).fill(2) },
  playlists: [{ id: 'p', name: 'Für Änne', songIds: songs.map(item => item.id), createdAt: 1, updatedAt: 2 }] });

test('round trips Unicode, current custom EQ and playlist order without audio data', () => {
  const backup = fixture([a, song('b', 'file:///Other/Case.mp3')]);
  expect(parseMusicBackup(serializeMusicBackup(backup))).toEqual(backup);
  expect(backup.songs[0]).not.toHaveProperty('cover');
  expect(backup.songs[0]).not.toHaveProperty('audioInfo');
});

test('round trips automatic update opt-outs while keeping older backups valid', () => {
  const backup = fixture();
  expect(parseMusicBackup(serializeMusicBackup(backup))).toEqual(backup);
  backup.settings.libraryUpdateV1 = { onOpen: true, whileOpen: false };
  expect(parseMusicBackup(serializeMusicBackup(backup)).settings.libraryUpdateV1).toEqual({ onOpen: true, whileOpen: false });
  expect(() => parseMusicBackup(JSON.stringify({ ...backup, settings: { libraryUpdateV1: { onOpen: true } } }))).toThrow();
});

test.each(['cover', 'green', 'cyan', 'turquoise', 'blue', 'violet', 'purple', 'pink', 'red', 'orange', 'yellow', 'neutral'] as const)(
  'backup preserves the three separate %s accent selections and transition preference', accent => {
    const backup = fixture();
    backup.settings.accentPreferencesV4 = { appAccent: accent, playerAccent: accent, instantColors: true };
    backup.settings.playerPresentationV3 = { quiet: false, density: 'compact', waveformAccent: accent };
    expect(parseMusicBackup(serializeMusicBackup(backup)).settings).toEqual(backup.settings);
  });
test('unknown accent values or a partial preference record cannot enter restore', () => {
  for (const preferences of [{ appAccent: 'unknown', playerAccent: 'cover', instantColors: false },
    { appAccent: 'blue', playerAccent: 'cover' }]) {
    const backup = fixture();
    expect(() => parseMusicBackup(JSON.stringify({ ...backup, settings: { accentPreferencesV4: preferences } }))).toThrow();
  }
});
test.each([
  ['unsupported version', { ...fixture(), version: 2 }],
  ['dangling playlist reference', { ...fixture(), playlists: [{ ...fixture().playlists[0], songIds: ['unknown'] }] }],
  ['duplicate reference ID', { ...fixture(), songs: [toBackupSongReference(a), toBackupSongReference(a)] }],
  ['unknown settings key', { ...fixture(), settings: { songs: [] } }],
  ['nonfinite or out of range EQ', { ...fixture(), settings: { eqBands: Array(10).fill(20) } }],
])('rejects %s before a restore plan can be made', (_label, value) => {
  expect(() => parseMusicBackup(JSON.stringify(value))).toThrow();
});
test('rejects oversized input before JSON.parse and reports corrupt JSON', () => {
  const parse = jest.spyOn(JSON, 'parse');
  expect(() => parseMusicBackup(' '.repeat(MAX_BACKUP_CODE_UNITS + 1))).toThrow('zu groß');
  expect(parse).not.toHaveBeenCalled();
  parse.mockRestore();
  expect(() => parseMusicBackup('{')).toThrow('gültiges JSON');
});
test('same display text and size never auto-map another URI or document case', () => {
  const backup = fixture();
  expect(mapBackupSongs(backup, [song('other', 'content://provider/document/case%2FSong')])[0].status).toBe('missing');
  expect(mapBackupSongs(backup, [song('a', a.uri!, 1800000000000)])[0].status).toBe('conflict');
  expect(mapBackupSongs(backup, [song('renumbered', a.uri!)])[0].song?.id).toBe('renumbered');
});
test('a unique full hash survives a folder move, duplicate strong matches remain conflicts', () => {
  const old = { ...a, fileInfo: { ...a.fileInfo, contentHash: 'a'.repeat(64) } };
  const moved = { ...song('moved', 'file:///New/Set.mp3'), fileInfo: { contentHash: 'a'.repeat(64) } };
  expect(mapBackupSongs(fixture([old]), [moved])[0].song).toBe(moved);
  expect(mapBackupSongs(fixture([old]), [moved, { ...moved, id: 'duplicate' }])[0].status).toBe('conflict');
});
test('a known full hash never silently falls back to size and time when one side is unverified', () => {
  const hashed = { ...a, fileInfo: { ...a.fileInfo, contentHash: 'a'.repeat(64) } };
  expect(mapBackupSongs(fixture([hashed]), [a])[0].status).toBe('conflict');
  expect(mapBackupSongs(fixture([a]), [hashed])[0].status).toBe('conflict');
});
test('manual mapping and explicit skip preserve live lists, merge favorites and retain order', () => {
  const backup = fixture([a, song('b', 'file:///Missing.mp3'), song('c', 'file:///Other.mp3')]);
  const current = song('current', 'file:///Selected.mp3');
  const live = [{ id: 'live', name: 'Für Änne', songIds: ['keep'], createdAt: 3, updatedAt: 4 }];
  const mapped = mapBackupSongs(backup, [a, current], { b: 'current', c: null });
  const merged = mergeBackupCollection(backup, mapped, live, ['keep', 'a'], 100);
  expect(merged.playlists[0]).toBe(live[0]);
  expect(merged.playlists[1]).toMatchObject({ name: 'Für Änne (Backup)', songIds: ['a', 'current'] });
  expect(merged.favorites).toEqual(['keep', 'a', 'current']);
  expect(merged.skippedSongs).toBe(1);
  const again = mergeBackupCollection(backup, mapped, merged.playlists, merged.favorites, 100);
  expect(new Set(again.playlists.map(item => item.id)).size).toBe(3);
});
test('large ordered playlist remains bounded and maps without changing source order', () => {
  const songs = Array.from({ length: 5000 }, (_, i) => song(`song-${i}`, `file:///Music/${i}.mp3`));
  const backup = parseMusicBackup(serializeMusicBackup(fixture(songs)));
  const merged = mergeBackupCollection(backup, mapBackupSongs(backup, songs), [], []);
  expect(merged.playlists[0].songIds).toEqual(songs.map(item => item.id));
});
