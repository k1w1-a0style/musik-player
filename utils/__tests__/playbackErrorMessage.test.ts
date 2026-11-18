import { describePlaybackError } from '../playbackErrorMessage';

test.each([
  ['ERROR_CODE_IO_FILE_NOT_FOUND', 'Datei nicht gefunden', false],
  ['ERROR_CODE_IO_NO_PERMISSION', 'Kein Zugriff', false],
  ['ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED', 'Audioformat', false],
  ['ERROR_CODE_DECODING_FAILED', 'Dekodieren', true],
  ['ERROR_CODE_DECODING_RESOURCES_RECLAIMED', 'vorübergehend belegt', true],
])('describes Android playback failure %s with the matching action', (platformCode, message, retry) => {
  const result = describePlaybackError({ code: 'source', message: 'raw native /file/uri.mp3', platformCode });
  expect(result.message).toContain(message);
  expect(result.message).not.toContain('/file/');
  expect(result.retry).toBe(retry);
});
