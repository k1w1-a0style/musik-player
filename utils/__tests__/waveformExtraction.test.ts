import SystemAudio from 'expo-system-audio';
import type { Song } from '../../types/Song';
import {
  buildImmediateWaveform,
  extractNativeWaveform,
  hasUsefulNativeShape,
  resolveWaveformUri,
  WAVEFORM_EXTRACTION_TIMEOUT_MS,
} from '../waveformExtraction';
import { getWaveformSourceKey } from '../waveformGenerator';

const mockedSystemAudio = SystemAudio as typeof SystemAudio & {
  extractWaveformPeaks?: jest.Mock;
};

const baseSong: Song = {
  id: 'song-1',
  title: 'Test Song',
  artist: 'Test Artist',
  uri: 'file:///fallback.mp3',
  duration: 123_000,
  fileInfo: {
    uri: 'file:///preferred.mp3',
    size: 42,
    importedAt: 1234,
  },
};

const dynamicPeaks = [0.04, 0.88, 0.12, 0.76, 0.2, 0.92, 0.34, 0.68, 0.16, 0.84];

describe('waveformExtraction', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('resolveWaveformUri', () => {
    test('prefers song.fileInfo.uri over song.uri', () => {
      expect(resolveWaveformUri(baseSong)).toBe('file:///preferred.mp3');
    });

    test('falls back to song.uri', () => {
      expect(resolveWaveformUri({ ...baseSong, fileInfo: undefined })).toBe('file:///fallback.mp3');
    });

    test('returns undefined for nullish songs', () => {
      expect(resolveWaveformUri(null)).toBeUndefined();
      expect(resolveWaveformUri(undefined)).toBeUndefined();
    });
  });

  describe('buildImmediateWaveform', () => {
    test('builds deterministic fallback waveforms', () => {
      jest.spyOn(Date, 'now').mockReturnValue(1000);

      const first = buildImmediateWaveform(baseSong, 123_000, 12);
      const second = buildImmediateWaveform(baseSong, 123_000, 12);

      expect(first).toEqual(second);
      expect(first.source).toBe('fallback');
      expect(first.sourceKey).toBe(getWaveformSourceKey(baseSong));
    });

    test('respects pointCount', () => {
      expect(buildImmediateWaveform(baseSong, 123_000, 16).points).toHaveLength(16);
    });
  });

  describe('hasUsefulNativeShape', () => {
    test.each([
      ['empty array', [], false],
      ['fewer than 8 finite values', [0.1, 0.4, 0.6, Number.NaN, Number.POSITIVE_INFINITY, 0.8, 0.9], false],
      ['flat values', Array(10).fill(0.5), false],
      ['ignores NaN and Infinity but accepts useful finite shape', [Number.NaN, 0.04, 0.88, Number.POSITIVE_INFINITY, 0.12, 0.76, 0.2, 0.92, Number.NEGATIVE_INFINITY, 0.34, 0.68, 0.16, 0.84], true],
      ['range just below threshold', [0.4, 0.57, 0.4, 0.57, 0.4, 0.57, 0.4, 0.57], false],
      ['variance just below threshold', [0.4, 0.58, 0.49, 0.49, 0.49, 0.49, 0.49, 0.49], false],
      ['clearly dynamic peaks', dynamicPeaks, true],
    ])('%s -> %s', (_name, points, expected) => {
      expect(hasUsefulNativeShape(points as number[])).toBe(expected);
    });
  });

  describe('extractNativeWaveform', () => {
    test('returns null without a URI', async () => {
      await expect(extractNativeWaveform({ id: 'no-uri', title: 'No URI', artist: 'Nobody' }, 1000)).resolves.toBeNull();
      expect(mockedSystemAudio.extractWaveformPeaks).not.toHaveBeenCalled();
    });

    test('returns null without a native extractor', async () => {
      delete (mockedSystemAudio as { extractWaveformPeaks?: unknown }).extractWaveformPeaks;

      await expect(extractNativeWaveform(baseSong, 1000)).resolves.toBeNull();
    });

    test.each([
      ['null result', null],
      ['empty points', { points: [] }],
    ])('returns null when native extractor returns %s', async (_name, nativeResult) => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue(nativeResult);

      await expect(extractNativeWaveform(baseSong, 1000)).resolves.toBeNull();
    });

    test('returns null for flat unusable native peaks', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({ points: Array(12).fill(0.5) });

      await expect(extractNativeWaveform(baseSong, 1000)).resolves.toBeNull();
    });

    test('returns null when native extractor rejects', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockRejectedValue(new Error('native failed'));

      await expect(extractNativeWaveform(baseSong, 1000)).resolves.toBeNull();
    });

    test('returns null on timeout without an unhandled rejection', async () => {
      jest.useFakeTimers();
      mockedSystemAudio.extractWaveformPeaks = jest.fn((_uri: string, _pointCount?: number) => new Promise<{ points: number[]; durationMs?: number } | null>(() => undefined));

      const extraction = extractNativeWaveform(baseSong, 1000);
      await jest.advanceTimersByTimeAsync(WAVEFORM_EXTRACTION_TIMEOUT_MS + 1);

      await expect(extraction).resolves.toBeNull();
    });

    test('returns native waveform for useful native peaks', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({ points: dynamicPeaks, durationMs: 2000 });

      const waveform = await extractNativeWaveform(baseSong, 1000, { pointCount: 8 });

      expect(waveform).toMatchObject({
        source: 'native',
        durationMs: 2000,
        sourceKey: getWaveformSourceKey(baseSong),
      });
      expect(waveform?.points).toHaveLength(8);
      expect(mockedSystemAudio.extractWaveformPeaks).toHaveBeenCalledWith('file:///preferred.mp3', 8);
    });

    test('returns null when the sourceKey no longer matches after native extraction', async () => {
      const mutableSong: Song = { ...baseSong, fileInfo: { ...baseSong.fileInfo } };
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockImplementation(async () => {
        mutableSong.fileInfo = { ...mutableSong.fileInfo, importedAt: 9999 };
        return { points: dynamicPeaks };
      });

      await expect(extractNativeWaveform(mutableSong, 1000)).resolves.toBeNull();
    });
  });
});
