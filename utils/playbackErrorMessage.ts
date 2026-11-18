import type { PlaybackError } from '../modules/playback-backend/types';

export const describePlaybackError = (error: PlaybackError): { message: string; retry: boolean } => {
  switch (error.platformCode) {
    case 'ERROR_CODE_IO_FILE_NOT_FOUND':
      return { message: 'Datei nicht gefunden. Prüfe die Musikquelle.', retry: false };
    case 'ERROR_CODE_IO_NO_PERMISSION':
      return { message: 'Kein Zugriff auf diese Datei. Prüfe die Freigabe der Musikquelle.', retry: false };
    case 'ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED':
    case 'ERROR_CODE_DECODING_FORMAT_EXCEEDS_CAPABILITIES':
    case 'ERROR_CODE_DECODING_FORMAT_UNSUPPORTED':
      return { message: 'Dieses Audioformat wird auf dem Gerät nicht unterstützt.', retry: false };
    case 'ERROR_CODE_PARSING_CONTAINER_MALFORMED':
      return { message: 'Die Audiodatei konnte nicht gelesen werden.', retry: false };
    case 'ERROR_CODE_DECODER_INIT_FAILED':
    case 'ERROR_CODE_DECODER_QUERY_FAILED':
    case 'ERROR_CODE_DECODING_FAILED':
      return { message: 'Fehler beim Dekodieren der Audiodatei.', retry: true };
    case 'ERROR_CODE_DECODING_RESOURCES_RECLAIMED':
      return { message: 'Der Audiodecoder ist vorübergehend belegt.', retry: true };
    default:
      return error.code === 'source'
        ? { message: 'Die Audioquelle konnte nicht geöffnet werden.', retry: true }
        : { message: 'Der Player konnte die Wiedergabe nicht starten.', retry: true };
  }
};
