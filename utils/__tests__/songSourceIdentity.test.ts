import { getSongSourceKey } from '../songSourceIdentity';

test('SAF grant paths resolve to the same case-sensitive document ID', () => {
  expect(getSongSourceKey('content://provider/tree/primary%3AMusic/document/primary%3AMusic%2FTrack.mp3'))
    .toBe(getSongSourceKey('content://provider/document/primary%3aMusic%2fTrack.mp3'));
  expect(getSongSourceKey('content://provider/document/primary%3AMusic%2FTrack.mp3'))
    .not.toBe(getSongSourceKey('content://provider/document/primary%3AMusic%2Ftrack.mp3'));
});
test('encoded document slashes are not decoded into URI path delimiters', () => {
  expect(getSongSourceKey('content://provider/document/a%2Fb'))
    .not.toBe(getSongSourceKey('content://provider/document/a/b'));
});
test('provider, query and fragment distinctions remain part of opaque identity', () => {
  const source = getSongSourceKey('content://provider/audio/42?selection=1#one');
  for (const uri of ['content://other/audio/42?selection=1#one', 'content://provider/audio/42?selection=2#one', 'content://provider/audio/42?selection=1#two']) {
    expect(source).not.toBe(getSongSourceKey(uri));
  }
});
test('file encoding variants match without folding filesystem case', () => {
  expect(getSongSourceKey('file:///Music/My%20Track.mp3?v=1')).toBe(getSongSourceKey('file:///Music/My Track.mp3'));
  expect(getSongSourceKey('file:///Music/Track.mp3')).not.toBe(getSongSourceKey('file:///music/track.mp3'));
  expect(getSongSourceKey('file:///Music/a%2Fb.mp3')).not.toBe(getSongSourceKey('file:///Music/a/b.mp3'));
});
test('empty and malformed sources are handled conservatively', () => {
  expect(getSongSourceKey(' ')).toBeUndefined();
  expect(getSongSourceKey('content://provider/document/a%ZZ')).toBe('content://provider/document/a%ZZ');
});
