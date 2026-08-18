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
import { resetWaveformExtractionLifecycleForTests } from '../waveformExtractionLifecycle';

const mockedSystemAudio = SystemAudio as typeof SystemAudio & {
  extractWaveformPeaks?: jest.Mock;
  hasNativeWaveformCancellation?: boolean;
  cancelWaveformExtraction?: jest.Mock;
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
    resetWaveformExtractionLifecycleForTests();
    jest.useRealTimers();
    mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue(null);
    mockedSystemAudio.hasNativeWaveformCancellation = false;
    mockedSystemAudio.cancelWaveformExtraction = jest.fn().mockReturnValue(false);
  });

  afterEach(() => {
    resetWaveformExtractionLifecycleForTests();
    jest.useRealTimers();
    jest.restoreAllMocks();
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
      ['flat decoded silence/master', Array(10).fill(0.04), true],
      ['rejects NaN and Infinity', [Number.NaN, 0.04, 0.88, Number.POSITIVE_INFINITY, 0.12, 0.76, 0.2, 0.92], false],
      ['rejects out-of-range values', [0.4, 0.57, 0.4, 1.2, 0.4, 0.57, 0.4, 0.57], false],
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

    test('rejects packet-size results from an older Development APK', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({ points: dynamicPeaks });

      await expect(extractNativeWaveform(baseSong, 1000)).resolves.toBeNull();
    });

    test('accepts a flat waveform when it is backed by decoded PCM', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({
        points: Array(12).fill(0.04), analysis: 'decoded-pcm-v1',
      });

      await expect(extractNativeWaveform(baseSong, 1000)).resolves.toMatchObject({ source: 'native' });
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

    test('cancels native work by request id when the JS waiter aborts', async () => {
      jest.useFakeTimers();
      mockedSystemAudio.hasNativeWaveformCancellation = true;
      mockedSystemAudio.extractWaveformPeaks = jest.fn(
        () => new Promise<{ points: number[]; durationMs?: number } | null>(() => undefined),
      );
      mockedSystemAudio.cancelWaveformExtraction = jest.fn().mockReturnValue(true);
      const controller = new AbortController();

      const extraction = extractNativeWaveform(baseSong, 1000, { signal: controller.signal });
      await jest.advanceTimersByTimeAsync(120);
      expect(mockedSystemAudio.extractWaveformPeaks).toHaveBeenCalledWith(
        'file:///preferred.mp3',
        72,
        expect.stringMatching(/^waveform-/),
      );

      controller.abort();
      await expect(extraction).resolves.toBeNull();
      expect(mockedSystemAudio.cancelWaveformExtraction).toHaveBeenCalledWith(
        expect.stringMatching(/^waveform-/),
      );
    });

    test('returns native waveform for useful native peaks', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({
        points: dynamicPeaks, durationMs: 2000, analysis: 'decoded-pcm-v1',
      });

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
        return { points: dynamicPeaks, analysis: 'decoded-pcm-v1' };
      });

      await expect(extractNativeWaveform(mutableSong, 1000)).resolves.toBeNull();
    });
  });

  describe('extractNativeWaveform onDecision traceability', () => {
    const m4aSong: Song = {
      ...baseSong,
      id: 'song-m4a',
      uri: 'file:///fallback.m4a',
      fileInfo: { uri: 'file:///preferred.m4a', size: 42, importedAt: 1234 },
    };

    test('reports no-uri without invoking the native extractor', async () => {
      const onDecision = jest.fn();
      await extractNativeWaveform({ id: 'x', title: 'X', artist: 'Y' }, 1000, { onDecision });
      expect(onDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'no-uri', source: 'fallback', container: 'other' }),
      );
    });

    test('reports no-native-extractor when the module lacks extraction', async () => {
      delete (mockedSystemAudio as { extractWaveformPeaks?: unknown }).extractWaveformPeaks;
      const onDecision = jest.fn();
      await extractNativeWaveform(baseSong, 1000, { onDecision });
      expect(onDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'no-native-extractor', source: 'fallback', container: 'mp3' }),
      );
    });

    test('reports native-empty for empty native peaks', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({ points: [] });
      const onDecision = jest.fn();
      await extractNativeWaveform(baseSong, 1000, { onDecision });
      expect(onDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'native-empty', source: 'fallback' }),
      );
    });

    test('reports unsupported analysis for legacy packet-size results', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({ points: dynamicPeaks });
      const onDecision = jest.fn();

      await extractNativeWaveform(baseSong, 1000, { onDecision });

      expect(onDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'native-unsupported-analysis', source: 'fallback' }),
      );
    });

    test('reports native-unusable-shape for invalid decoded peaks (same gate for mp3 and m4a)', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({
        points: [0.04, 0.2, 0.4, 0.6, 0.8, 1.2, 0.3, 0.5], analysis: 'decoded-pcm-v1',
      });
      const mp3Decision = jest.fn();
      const m4aDecision = jest.fn();

      await extractNativeWaveform(baseSong, 1000, { onDecision: mp3Decision });
      await extractNativeWaveform(m4aSong, 1000, { onDecision: m4aDecision });

      expect(mp3Decision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'native-unusable-shape', source: 'fallback', container: 'mp3' }),
      );
      expect(m4aDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'native-unusable-shape', source: 'fallback', container: 'm4a' }),
      );
    });

    test('reports native-accepted with matching container for useful peaks', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockResolvedValue({
        points: dynamicPeaks, durationMs: 2000, analysis: 'decoded-pcm-v1',
      });
      const onDecision = jest.fn();
      const waveform = await extractNativeWaveform(m4aSong, 1000, { pointCount: 8, onDecision });
      expect(waveform?.source).toBe('native');
      expect(onDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'native-accepted', source: 'native', container: 'm4a' }),
      );
    });

    test('reports native-error when the native extractor rejects', async () => {
      mockedSystemAudio.extractWaveformPeaks = jest.fn().mockRejectedValue(new Error('boom'));
      const onDecision = jest.fn();
      await extractNativeWaveform(baseSong, 1000, { onDecision });
      expect(onDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'native-error', source: 'fallback' }),
      );
    });
  });
});
