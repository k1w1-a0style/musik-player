import SystemAudio from 'expo-system-audio';
import type { Song } from '../types/Song';
import { isAbortError, isTimeoutError, withTimeout } from './withTimeout';
import {
  clearWaveformFailure,
  getWaveformFailureBackoff,
  recordWaveformFailure,
  scheduleNativeWaveformExtraction,
  WaveformSchedulerUnavailableError,
} from './waveformExtractionLifecycle';
import { buildFallbackWaveform, buildNativeWaveform, getWaveformSourceKey } from './waveformGenerator';
import { DEFAULT_WAVEFORM_POINT_COUNT, type NativeWaveformResult, type SongWaveform } from './waveformTypes';
import {
  classifyWaveformContainer,
  type NativeWaveformDecision,
  type WaveformSourceDiagnostics,
} from './waveformDecision';

export const WAVEFORM_EXTRACTION_TIMEOUT_MS = 25_000;
let waveformRequestSequence = 0;

const nextWaveformRequestId = (): string =>
  `waveform-${Date.now().toString(36)}-${(++waveformRequestSequence).toString(36)}`;

export const resolveWaveformUri = (song: Song | null | undefined): string | undefined =>
  song?.fileInfo?.uri ?? song?.uri;

export const buildImmediateWaveform = (
  song: Song | null | undefined,
  durationMs: number,
  pointCount = DEFAULT_WAVEFORM_POINT_COUNT,
): SongWaveform => buildFallbackWaveform(song, durationMs, pointCount);

export const hasUsefulNativeShape = (points: readonly number[]): boolean => {
  const finite = points.filter(point => Number.isFinite(point));
  if (finite.length < 8) return false;
  // A decoded silent passage or an intentionally flat master is still valid
  // audio evidence. Shape/variance gates used for packet-size approximations
  // would incorrectly reject exactly those files.
  return finite.length === points.length && finite.every(point => point >= 0 && point <= 1);
};

type DecisionReporter = (decision: NativeWaveformDecision, nativePointCount: number) => void;
type NativeWaveformExtractor = (
  uri: string,
  pointCount?: number,
  requestId?: string,
) => Promise<NativeWaveformResult | null>;

interface NativeWaveformCancellationApi {
  hasNativeWaveformCancellation?: boolean;
  cancelWaveformExtraction?: (requestId: string) => boolean;
}

const runScheduledNativeExtraction = (
  extractor: NativeWaveformExtractor,
  cancellationApi: NativeWaveformCancellationApi,
  uri: string,
  pointCount: number,
  sourceKey: string,
  signal?: AbortSignal,
): Promise<NativeWaveformResult | null> => withTimeout(
  waiterSignal => scheduleNativeWaveformExtraction(
    sourceKey,
    async nativeSignal => {
      if (!cancellationApi.hasNativeWaveformCancellation || !cancellationApi.cancelWaveformExtraction) {
        return extractor(uri, pointCount);
      }
      const requestId = nextWaveformRequestId();
      const cancel = () => { cancellationApi.cancelWaveformExtraction?.(requestId); };
      nativeSignal.addEventListener('abort', cancel, { once: true });
      try {
        if (nativeSignal.aborted) cancel();
        return await extractor(uri, pointCount, requestId);
      } finally {
        nativeSignal.removeEventListener('abort', cancel);
      }
    },
    waiterSignal,
  ),
  WAVEFORM_EXTRACTION_TIMEOUT_MS,
  'Waveform extraction timed out',
  { signal },
);

const acceptDecodedNativeResult = ({ result, song, durationMs, pointCount, sourceKey, report }: {
  result: NativeWaveformResult | null;
  song: Song | null | undefined;
  durationMs: number;
  pointCount: number;
  sourceKey: string;
  report: DecisionReporter;
}): SongWaveform | null => {
  const points = result?.points ?? [];
  if (!result || points.length === 0) {
    recordWaveformFailure(sourceKey, 'native-empty');
    report('native-empty', 0);
    return null;
  }
  // Older Development APKs returned compressed packet sizes. Those values can
  // visibly contradict silence/peaks in the actual audio and are never shown.
  if (result.analysis !== 'decoded-pcm-v1') {
    recordWaveformFailure(sourceKey, 'native-unsupported-analysis');
    report('native-unsupported-analysis', points.length);
    return null;
  }
  if (!hasUsefulNativeShape(points)) {
    recordWaveformFailure(sourceKey, 'native-unusable-shape');
    report('native-unusable-shape', points.length);
    return null;
  }
  const waveform = buildNativeWaveform(song, result, durationMs, pointCount);
  if (waveform.sourceKey !== sourceKey) {
    report('native-source-key-changed', points.length);
    return null;
  }
  report('native-accepted', points.length);
  clearWaveformFailure(sourceKey);
  return waveform;
};

const handleNativeExtractionError = (
  error: unknown,
  sourceKey: string,
  report: DecisionReporter,
): null => {
  if (isAbortError(error)) return null;
  if (error instanceof WaveformSchedulerUnavailableError) {
    // Global capacity pressure is transient; do not create source backoff.
    report('native-scheduler-unavailable', 0);
    return null;
  }
  if (isTimeoutError(error)) {
    recordWaveformFailure(sourceKey, 'native-timeout');
    report('native-timeout', 0);
    return null;
  }
  recordWaveformFailure(sourceKey, 'native-error');
  report('native-error', 0);
  return null;
};

export const extractNativeWaveform = async (
  song: Song | null | undefined,
  durationMs: number,
  options?: {
    pointCount?: number;
    signal?: AbortSignal;
    onDecision?: (diagnostics: WaveformSourceDiagnostics) => void;
  },
): Promise<SongWaveform | null> => {
  const uri = resolveWaveformUri(song);
  const sourceKey = getWaveformSourceKey(song);
  const pointCount = options?.pointCount ?? DEFAULT_WAVEFORM_POINT_COUNT;
  const container = classifyWaveformContainer(uri);
  const report = (decision: NativeWaveformDecision, nativePointCount: number): void => {
    options?.onDecision?.({
      container,
      decision,
      source: decision === 'native-accepted' ? 'native' : 'fallback',
      nativePointCount,
    });
  };
  const extractor = (SystemAudio as unknown as {
    extractWaveformPeaks?: NativeWaveformExtractor;
  }).extractWaveformPeaks;
  const cancellationApi = SystemAudio as NativeWaveformCancellationApi;

  if (!uri) {
    report('no-uri', 0);
    return null;
  }
  if (!extractor) {
    report('no-native-extractor', 0);
    return null;
  }

  if (getWaveformFailureBackoff(sourceKey)) return null;

  try {
    const result = await runScheduledNativeExtraction(
      extractor, cancellationApi, uri, pointCount, sourceKey, options?.signal,
    );
    return acceptDecodedNativeResult({ result, song, durationMs, pointCount, sourceKey, report });
  } catch (error) {
    return handleNativeExtractionError(error, sourceKey, report);
  }
};
