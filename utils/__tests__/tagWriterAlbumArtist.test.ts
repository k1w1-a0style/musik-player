import { applyTagEditToBuffer, decodeSynchsafe } from '../tagWriter';

const frameIds = (buffer: Uint8Array): string[] => {
  const ids: string[] = [];
  const size = decodeSynchsafe(buffer.slice(6, 10));
  let p = 10;
  const end = 10 + size;
  while (p + 10 <= end && buffer[p] !== 0) {
    ids.push(String.fromCharCode(buffer[p], buffer[p + 1], buffer[p + 2], buffer[p + 3]));
    const frameSize =
      (buffer[p + 4] << 24) |
      (buffer[p + 5] << 16) |
      (buffer[p + 6] << 8) |
      buffer[p + 7];
    p += 10 + frameSize;
  }
  return ids;
};

describe('tagWriter albumArtist', () => {
  test('writes albumArtist as ID3 TPE2 without replacing track artist', () => {
    const out = applyTagEditToBuffer(new Uint8Array([1, 2, 3, 4]), 'mp3', {
      songId: 's1',
      tags: {
        artist: 'Track Artist',
        albumArtist: 'Various Artists',
      },
    });

    expect(frameIds(out)).toEqual(expect.arrayContaining(['TPE1', 'TPE2']));
  });

  test('albumArtist-only draft is a real tag edit intent', () => {
    const out = applyTagEditToBuffer(new Uint8Array([9, 8, 7]), 'mp3', {
      songId: 's1',
      tags: { albumArtist: 'Compilation Artist' },
    });

    expect(frameIds(out)).toContain('TPE2');
  });
});