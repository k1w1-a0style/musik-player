import { groupSongs, mergeSongs, mergeSongPreservingRichMetadata } from '../libraryPresentation';
import { sortLibrarySongs } from '../librarySort';
import { readImportFileRevision, compareImportFileRevision } from '../importFileRevision';
import { getInfoAsync } from 'expo-file-system/legacy';
import { SystemAudio } from 'expo-system-audio';
import type { Song } from '../../types/Song';

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
const song = (id: string, patch: Partial<Song> = {}): Song => ({
  id, title: id, artist: 'Artist', uri: `file:///music/${id}.mp3`, ...patch,
});

describe('library integrity: independent sources and authoritative rescans', () => {
  test('keeps case-sensitive provider document IDs separate', () => {
    expect(mergeSongs([], [
      song('upper', { uri: 'content://provider/document/CaseSensitiveID' }),
      song('lower', { uri: 'content://provider/document/casesensitiveid' }),
    ])).toHaveLength(2);
  });
  test('keeps different files with coincidentally equal filename, size and duration', () => {
    expect(mergeSongs([], [
      song('a', { duration: 180000, fileInfo: { uri: 'file:///albumA/01.mp3', filename: '01.mp3', size: 1000000 } }),
      song('b', { duration: 180000, fileInfo: { uri: 'file:///albumB/01.mp3', filename: '01.mp3', size: 1000000 } }),
    ])).toHaveLength(2);
  });
  test('album playback follows disc and track numbers instead of titles', () => {
    const first = song('first', { title: 'Zebra', album: 'Set', trackNumber: '1', discNumber: '1' });
    const second = song('second', { title: 'Alpha', album: 'Set', trackNumber: '2', discNumber: '1' });
    expect(groupSongs([first, second], 'album')[0].songs.map(item => item.id)).toEqual(['first', 'second']);
  });
  test('orders the first disc before later discs', () => {
    expect(sortLibrarySongs([
      song('disc1track2', { discNumber: '1', trackNumber: '2' }),
      song('disc2track1', { discNumber: '2', trackNumber: '1' }),
    ], 'trackNumber').map(item => item.id)).toEqual(['disc1track2', 'disc2track1']);
  });
  test('separates albums by different artists without albumArtist', () => {
    expect(groupSongs([
      song('a', { album: 'Greatest Hits', artist: 'Artist A' }),
      song('b', { album: 'Greatest Hits', artist: 'Artist B' }),
    ], 'album')).toHaveLength(2);
  });
  test('clears fields that a successful authoritative inspection confirmed absent', () => {
    const before = song('a', { album: 'Old', genre: 'Old', cover: 'file:///old.png' });
    const inspected = {
      ...song('a', { album: undefined, genre: undefined, cover: undefined,
        coverInfo: { status: 'none', embeddedArtworkChecked: true } }),
      metadataInspection: { absentFields: ['album', 'genre'] as const },
    };
    const merged = mergeSongPreservingRichMetadata(before, inspected);
    expect(merged.album).toBeUndefined();
    expect(merged.genre).toBeUndefined();
    expect(merged.cover).toBeUndefined();
  });
  test('normalizes Expo seconds before comparing with native milliseconds', async () => {
    (SystemAudio.readImportFileStat as jest.Mock).mockResolvedValue(null);
    (getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true, size: 1000, modificationTime: 1700000000, md5: 'unchanged',
    });
    const full = await readImportFileRevision('file:///track.mp3', {}, undefined, { verifyContent: true });
    expect(full.modificationTime).toBe(1700000000000);
    (SystemAudio.readImportFileStat as jest.Mock).mockResolvedValue({ size: 1000, modificationTime: 1700000000000 });
    expect(compareImportFileRevision(full, await readImportFileRevision('file:///track.mp3'))).toBe('same');
  });
});

