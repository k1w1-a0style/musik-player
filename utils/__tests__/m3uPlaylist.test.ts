import { parseM3u, serializeM3u8, resolveM3u } from '../m3uPlaylist';
import type { Song } from '../../types/Song';

const song = (id: string, uri: string): Song => ({ id, uri, title: `Grüße ${id}`, artist: 'K1W1', duration: 12 });
const songs = [song('a', 'file:///storage/emulated/0/Music/%C3%84.mp3'),
  song('b', 'content://provider/document/42')];
test('UTF-8 BOM, CRLF, EXTINF, comments and plain M3U preserve entry order', () => {
  expect(parseM3u('\ufeff#EXTM3U\r\n#EXTINF:12,Grüße\r\nMusic/Ä.mp3\r\n# comment\r\ncontent://provider/document/42\r\n'))
    .toEqual([{ location: 'Music/Ä.mp3', label: 'Grüße', line: 3 },
      { location: 'content://provider/document/42', label: undefined, line: 5 }]);
});
test('roundtrip keeps Unicode, order and exact content sources', () => {
  const result = resolveM3u(parseM3u(serializeM3u8(songs)), songs, 'content://opaque/playlist');
  expect(result.songs).toEqual(songs);
  expect(result.unresolved).toEqual([]);
});
test('relative external-storage document paths resolve exactly; title/basename guesses do not', () => {
  const result = resolveM3u(parseM3u('Ä.mp3\nelsewhere/Ä.mp3\nhttps://bad.example/Ä.mp3\n'), songs,
    'content://com.android.externalstorage.documents/document/primary%3AMusic%2Flist.m3u8');
  expect(result.songs.map(s => s.id)).toEqual(['a']);
  expect(result.unresolved.map(x => x.reason)).toEqual(['missing', 'unsupported']);
});
test('ambiguous aliases fail closed; duplicates are explicit and never multiply existing playlist IDs', () => {
  const result = resolveM3u(parseM3u(`${songs[0].uri}\n${songs[1].uri}\n${songs[1].uri}`),
    [...songs, song('other', songs[0].uri!)], 'file:///list.m3u');
  expect(result.songs.map(s => s.id)).toEqual(['b']);
  expect(result.duplicates).toBe(1);
  expect(result.unresolved[0].reason).toBe('ambiguous');
});
test('relative paths at opaque provider have no invented filesystem base', () => {
  expect(resolveM3u(parseM3u('Ä.mp3'), songs, 'content://opaque/55').unresolved[0].reason).toBe('relative');
});
test.each(['\u0000', '\ufffd', '#EXTM3U\n' + 'x'.repeat(8193), 'a\n'.repeat(10001), 'x'.repeat(2_097_153)])(
  'invalid encoding or bounded input rejects before mutation', raw => { expect(() => parseM3u(raw)).toThrow(); },
);
test('export sanitizes EXTINF injection and refuses remote/missing/unrepresentable sources', () => {
  expect(serializeM3u8([{ ...songs[0], title: 'A\nhttps://evil', artist: 'X\r#EXTINF:0,Y' }]))
    .toContain('#EXTINF:12,X #EXTINF:0,Y - A https://evil\n');
  for (const uri of [undefined, 'https://example/a.mp3', 'file:///a\nb.mp3']) {
    expect(() => serializeM3u8([{ ...songs[0], uri }])).toThrow();
  }
});
test('10,000 known songs resolve once in stable order without basename searches', () => {
  const large = Array.from({ length: 10000 }, (_, i) => song(String(i), `file:///Music/${i}.flac`));
  expect(resolveM3u(parseM3u(serializeM3u8(large)), large, 'file:///list.m3u8').songs).toEqual(large);
});
