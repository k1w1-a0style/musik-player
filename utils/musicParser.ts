/**
 * Formatiert Millisekunden in M:SS.
 */
export const formatTime = (milliseconds: number): string => {
  if (!isFinite(milliseconds) || milliseconds < 0) return '0:00';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Leitet Titel/Künstler aus einem Dateinamen ab (Fallback-Parser).
 * Auf Native ist eine robuste ID3-Extraktion ein Native-Modul-Thema
 * (z.B. react-native-music-library). Dieser Helfer ist nur ein Fallback.
 */
export interface ParsedFilename {
  title: string;
  artist?: string;
}

export const parseFilename = (filename: string): ParsedFilename => {
  const clean = filename.replace(/\.[^.]+$/, '').trim();
  const parts = clean.split(/\s*[-–]\s*/);
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(' - ') };
  }
  return { title: clean };
};
