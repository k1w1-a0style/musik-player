import {
  buildAlbumGroups,
  formatAlbumSongCount,
  getAlbumGroupName,
  UNKNOWN_ALBUM,
} from '../coversHelpers';
import type { Song } from '../../types/Song';

const songs: Song[] = [
  { id: 's1', title: 'One', artist: 'Artist', album: 'Beta', cover: 'file:///beta.jpg' },
  { id: 's2', title: 'Two', artist: 'Artist', album: ' Alpha ' },
  { id: 's3', title: 'Three', artist: 'Artist', album: 'Beta' },
  { id: 's4', title: 'Four', artist: 'Artist' },
];

describe('coversHelpers', () => {
  test('gets album group names with fallback', () => {
    expect(getAlbumGroupName(songs[0])).toBe('Beta');
    expect(getAlbumGroupName(songs[1])).toBe('Alpha');
    expect(getAlbumGroupName(songs[3])).toBe(UNKNOWN_ALBUM);
  });

  test('builds sorted album groups with first artwork uri', () => {
    const groups = buildAlbumGroups(songs);

    expect(groups.map(group => group.name)).toEqual(['Alpha', 'Beta', UNKNOWN_ALBUM]);
    expect(groups.find(group => group.name === 'Beta')?.songs).toHaveLength(2);
    expect(groups.find(group => group.name === 'Beta')?.artworkUri).toBe('file:///beta.jpg');
  });

  test('formats album song counts', () => {
    expect(formatAlbumSongCount(1)).toBe('1 Titel');
    expect(formatAlbumSongCount(2)).toBe('2 Titel');
  });
});
