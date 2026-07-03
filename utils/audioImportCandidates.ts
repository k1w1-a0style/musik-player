import { AUDIO_EXTENSIONS, KNOWN_NON_AUDIO_EXTENSIONS } from './audioExtensions';

const GENERIC_MIME_TYPES = new Set(['application/octet-stream', 'application/x-octet-stream', 'binary/octet-stream']);
const SUPPORTED_AUDIO_CONTAINER_MIME_TYPES = new Set(['application/ogg', 'application/x-ogg']);
const EXPLICIT_NON_AUDIO_MIME_PREFIXES = ['image/', 'video/'];

type AudioCandidateMimeClassification = 'audio' | 'explicit-non-audio' | 'generic' | 'supported-audio-container' | 'concrete-non-audio';

export interface AudioCandidateInput {
  mimeType?: string | null;
  displayName?: string | null;
  uri?: string | null;
}

export interface AudioCandidateDecision {
  accepted: boolean;
  reason: 'audio-mime' | 'audio-extension' | 'mp4-audio-mime' | 'non-audio-mime' | 'mp4-without-audio-mime' | 'known-non-audio-extension' | 'missing-audio-identity';
  normalizedMimeType?: string;
  extension?: string;
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeAudioCandidateMimeType = (mimeType?: string | null): string | undefined => {
  const normalized = mimeType?.trim().toLowerCase();
  return normalized || undefined;
};

const classifyAudioCandidateMimeType = (normalizedMimeType?: string): AudioCandidateMimeClassification => {
  if (!normalizedMimeType || GENERIC_MIME_TYPES.has(normalizedMimeType)) return 'generic';
  if (normalizedMimeType.startsWith('audio/')) return 'audio';
  if (EXPLICIT_NON_AUDIO_MIME_PREFIXES.some(prefix => normalizedMimeType.startsWith(prefix))) return 'explicit-non-audio';
  if (SUPPORTED_AUDIO_CONTAINER_MIME_TYPES.has(normalizedMimeType)) return 'supported-audio-container';
  return 'concrete-non-audio';
};

const stripQueryAndFragment = (value: string): string => value.split(/[?#]/)[0] ?? value;

const basename = (value: string): string => {
  const decoded = safeDecode(stripQueryAndFragment(value)).replace(/\\/g, '/').replace(/\/+$/, '');
  return decoded.split('/').filter(Boolean).pop() ?? decoded;
};

export const deriveAudioCandidateExtension = (candidate: AudioCandidateInput): string | undefined => {
  const values = [candidate.displayName, candidate.uri];
  for (const value of values) {
    if (!value) continue;
    const name = basename(value);
    const dotIndex = name.lastIndexOf('.');
    if (dotIndex >= 0 && dotIndex < name.length - 1) return name.slice(dotIndex + 1).trim().toLowerCase();
  }
  return undefined;
};

export const isSupportedAudioCandidate = (candidate: AudioCandidateInput): AudioCandidateDecision => {
  const normalizedMimeType = normalizeAudioCandidateMimeType(candidate.mimeType);
  const extension = deriveAudioCandidateExtension(candidate);
  const mimeClassification = classifyAudioCandidateMimeType(normalizedMimeType);
  const allowsExtensionFallback = mimeClassification === 'generic' || mimeClassification === 'supported-audio-container';

  if (mimeClassification === 'explicit-non-audio') {
    return { accepted: false, reason: 'non-audio-mime', normalizedMimeType, extension };
  }

  if (mimeClassification === 'audio') {
    if (extension === 'mp4') return { accepted: true, reason: 'mp4-audio-mime', normalizedMimeType, extension };
    return { accepted: true, reason: 'audio-mime', normalizedMimeType, extension };
  }

  if (extension && KNOWN_NON_AUDIO_EXTENSIONS.has(extension)) {
    return { accepted: false, reason: 'known-non-audio-extension', normalizedMimeType, extension };
  }

  if (extension === 'mp4') {
    return { accepted: false, reason: 'mp4-without-audio-mime', normalizedMimeType, extension };
  }

  if (extension && AUDIO_EXTENSIONS.has(extension) && allowsExtensionFallback) {
    return { accepted: true, reason: 'audio-extension', normalizedMimeType, extension };
  }

  if (mimeClassification === 'concrete-non-audio') {
    return { accepted: false, reason: 'non-audio-mime', normalizedMimeType, extension };
  }

  return { accepted: false, reason: 'missing-audio-identity', normalizedMimeType, extension };
};
