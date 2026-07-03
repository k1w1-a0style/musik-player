import { isSupportedAudioCandidate } from '../audioImportCandidates';

describe('isSupportedAudioCandidate', () => {
  test.each([
    ['audio/mpeg', 'song.mp3', undefined],
    ['audio/mp4', 'song.m4a', undefined],
    ['audio/x-m4a', 'song', undefined],
    ['', 'song.mp3', undefined],
    ['', 'SONG.M4A', undefined],
    ['application/ogg', 'track.ogg', undefined],
    ['application/ogg', 'track.opus', undefined],
    ['application/x-ogg', 'track.ogg', undefined],
    ['application/octet-stream', 'track.flac', undefined],
    ['application/x-octet-stream', 'track.ogg', undefined],
    ['binary/octet-stream', 'track.opus', undefined],
    [undefined, 'track.mp3', undefined],
    [undefined, undefined, 'content://provider/tree/Music%2FTrack.mp3'],
    ['', 'My%20Song.M4A', undefined],
    [null, undefined, 'content://provider/document/primary%3AMusic%2FEncoded%20Song.FLAC?x=1'],
  ])('accepts mime=%p displayName=%p uri=%p', (mimeType, displayName, uri) => {
    expect(isSupportedAudioCandidate({ mimeType, displayName, uri }).accepted).toBe(true);
  });

  test.each([
    ['application/octet-stream', 'cover.jpg', undefined],
    ['image/jpeg', 'track.mp3', undefined],
    ['application/pdf', 'fake.mp3', undefined],
    ['text/plain', 'notes.flac', undefined],
    ['application/json', 'data.ogg', undefined],
    ['', 'cover.jpg', undefined],
    [undefined, undefined, 'content://provider/Music/cover.JPG'],
    [undefined, 'clip.mp4', undefined],
    [null, 'clip.mp4', undefined],
    ['video/mp4', 'song.mp3', undefined],
  ])('rejects non-audio mime=%p displayName=%p uri=%p', (mimeType, displayName, uri) => {
    expect(isSupportedAudioCandidate({ mimeType, displayName, uri }).accepted).toBe(false);
  });

  test('accepts .mp4 only with an audio MIME type to avoid video imports', () => {
    expect(isSupportedAudioCandidate({ mimeType: 'audio/mp4', displayName: 'track.mp4' })).toMatchObject({ accepted: true, reason: 'mp4-audio-mime' });
    expect(isSupportedAudioCandidate({ mimeType: 'application/octet-stream', displayName: 'clip.mp4' })).toMatchObject({ accepted: false, reason: 'mp4-without-audio-mime' });
  });
});
