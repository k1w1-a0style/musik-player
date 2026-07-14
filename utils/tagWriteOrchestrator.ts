import type { Song } from '../types/Song';
import type {
  TagEditDraft,
  TagWriterErrorCode,
  WriteOperationPlan,
  RollbackPlan,
  WriteOrchestrationResult,
  TagEditableContainer,
} from '../types/TagEdit';
import {
  getTagEditCapability,
  getSupportedContainer,
  getUriType,
} from './tagEditCapability';
import { validateCoverPayload, validateEditableTags } from './tagValidation';

export const DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES = 50 * 1024 * 1024;

const buildRollbackSteps = (targetUri: string): string[] => [
  'Abort replacement and keep original file untouched.',
  `If replacement started, restore backup copy to ${targetUri}.`,
  'Clean up temporary output and backup artifacts.',
];

const getRiskLevel = (uriType: string): 'low' | 'medium' | 'high' => {
  if (uriType === 'file') return 'medium';
  if (uriType === 'content') return 'high';
  return 'low';
};

const getPrimaryBlockingReasonFromList = (
  reasons: TagWriterErrorCode[],
): TagWriterErrorCode | undefined => {
  const priority: TagWriterErrorCode[] = [
    'FileTooLarge',
    'InvalidTagData',
    'UnsupportedUri',
    'UnsupportedFormat',
    'MissingWritePermission',
    'WriteNotImplemented',
  ];
  return priority.find(reason => reasons.includes(reason));
};

const containerWarning = (container: TagEditableContainer): string | undefined => {
  if (container === 'mp3' || container === 'm4a' || container === 'mp4')
    return 'MP3/M4A/MP4 file:// writes use guarded backup + temp + byte verification; SAF content:// writes use native permission checks, in-memory original restore attempts, and post-write byte verification when Android SAF write permission is available.';
  return undefined;
};

const getKnownFileSize = (song: Song): number | undefined => {
  const size = song.fileInfo?.size;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
};

export const validateWritePreconditions = (
  song: Song,
  draft: TagEditDraft,
  platform?: string,
  maxFileSizeBytes = DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES,
): TagWriterErrorCode[] => {
  const errors: TagWriterErrorCode[] = [];
  const uri = song.fileInfo?.uri ?? song.uri;
  const capability = getTagEditCapability(song, platform);
  const container = getSupportedContainer(song);
  const uriType = getUriType(uri);
  const normalized = { ...draft, cover: draft.removeCover ? undefined : draft.cover };
  const knownFileSize = getKnownFileSize(song);

  const tagValidation = validateEditableTags(normalized.tags);
  if (!tagValidation.valid || !validateCoverPayload(normalized.cover))
    errors.push('InvalidTagData');
  if (!uri || uriType === 'empty' || uriType === 'unknown' || uriType === 'remote')
    errors.push('UnsupportedUri');
  if (container === 'unsupported') errors.push('UnsupportedFormat');
  if (typeof knownFileSize === 'number' && knownFileSize > maxFileSizeBytes)
    errors.push('FileTooLarge');
  if (uriType === 'content' && !capability.canWrite)
    errors.push('WriteNotImplemented');
  if (uriType === 'file' && container !== 'unsupported' && !capability.canWrite)
    errors.push('WriteNotImplemented');

  return [...new Set(errors)];
};

export const createRollbackPlan = (plan: WriteOperationPlan): RollbackPlan => ({
  required: plan.requiresBackup || plan.requiresTempFile,
  supportsRollback: plan.uriType === 'file',
  steps: buildRollbackSteps(plan.targetUri),
});

export const createTagWriteOperationPlan = (
  song: Song,
  draft: TagEditDraft,
  platform?: string,
  maxFileSizeBytes = DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES,
): WriteOperationPlan => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const safeUri = uri ?? '';
  const capability = getTagEditCapability(song, platform);
  const container = getSupportedContainer(song);
  const uriType = getUriType(uri);
  const warnings = [...(capability.reason ? [capability.reason] : [])];
  const containerWarn = containerWarning(container);
  if (containerWarn) warnings.push(containerWarn);
  if (draft.removeCover && draft.cover)
    warnings.push('removeCover=true takes precedence over cover payload.');
  const knownFileSize = getKnownFileSize(song);
  if (typeof knownFileSize === 'number' && knownFileSize > maxFileSizeBytes) {
    warnings.push(
      `File is larger than ${Math.round(maxFileSizeBytes / (1024 * 1024))} MB, so in-app tag writing is blocked before reading bytes.`,
    );
  }
  if (uriType === 'content')
    warnings.push(
      'SAF/content:// writes require native ContentResolver write permission, provider writable flags, and post-write verification; they do not currently provide durable backup, atomic replacement, or crash recovery.',
    );
  if (uriType === 'file')
    warnings.push(
      'file:// writes use backup + temp + byte verification; the final replace is guarded but not guaranteed OS-atomic.',
    );

  const blockingReasons = validateWritePreconditions(song, draft, platform, maxFileSizeBytes);
  const plan: WriteOperationPlan = {
    sourceUri: safeUri,
    targetUri: safeUri,
    uriType,
    container,
    permission: {
      canRead: capability.canRead,
      canWrite: capability.canWrite,
      requiresSafPermission: uriType === 'content',
      reason: capability.reason,
    },
    backup: {
      required: uriType === 'file' || uriType === 'content',
      backupUri: uriType === 'file' && safeUri ? `${safeUri}.bak` : undefined,
      strategy: uriType === 'file' ? 'sidecar-copy' : uriType === 'content' ? 'in-memory-original' : 'none',
    },
    atomicWrite: {
      required: uriType === 'file' || uriType === 'content',
      tempUri: uriType === 'file' && safeUri ? `${safeUri}.tmp` : undefined,
      supportsAtomicReplace: false,
    },
    rollback: { required: false, supportsRollback: false, steps: [] },
    requiresBackup: uriType === 'file' || uriType === 'content',
    requiresTempFile: uriType === 'file' || uriType === 'content',
    supportsAtomicReplace: false,
    supportsRollback: uriType === 'file',
    safetyCapabilities: {
      durableBackup: uriType === 'file',
      inMemoryRollback: uriType === 'content' && container !== 'unsupported',
      atomicReplace: false,
      postWriteVerification: uriType === 'file' || uriType === 'content',
      crashRecovery: false,
    },
    requiresUserConfirmation: uriType === 'content' || getRiskLevel(uriType) === 'high',
    requiresFullRewrite: container !== 'unsupported',
    estimatedRisk: getRiskLevel(uriType),
    warnings,
    blockingReasons,
  };
  plan.rollback = createRollbackPlan(plan);
  return plan;
};

export const getPrimaryBlockingReason = (
  plan: WriteOperationPlan,
): TagWriterErrorCode | undefined =>
  getPrimaryBlockingReasonFromList(plan.blockingReasons);

export const assertSafeWriteAllowed = (
  plan: WriteOperationPlan,
): TagWriterErrorCode | null => {
  const primary = getPrimaryBlockingReasonFromList(plan.blockingReasons);
  return primary ?? null;
};

export const simulateTagWriteOperation = (
  plan: WriteOperationPlan,
): WriteOrchestrationResult => {
  const primaryBlockingReason = getPrimaryBlockingReason(plan);
  const simulatedSteps = [
    `Plan created for ${plan.container} at ${plan.targetUri || '<missing-uri>'}.`,
    plan.requiresBackup
      ? 'Would create backup sidecar before any write.'
      : 'No backup step required.',
    plan.requiresTempFile
      ? 'Would write output to temp file first.'
      : 'No temp file required.',
    'Would validate written output metadata before replace step.',
    plan.safetyCapabilities.atomicReplace
      ? 'Would perform atomic replace.'
      : 'OS-atomic replace is not guaranteed by the current plan.',
    plan.safetyCapabilities.durableBackup
      ? 'Durable sidecar backup would be available before replace.'
      : 'No durable sidecar backup is available for this URI type.',
    plan.safetyCapabilities.inMemoryRollback
      ? 'Only in-memory rollback is available if the provider write fails.'
      : 'No rollback guarantee is available for this URI type.',
    plan.safetyCapabilities.crashRecovery
      ? 'Crash recovery journal would be available.'
      : 'Crash recovery is not available in the current plan.',
    'Dry-run only: no filesystem mutation performed.',
  ];

  return {
    ok: plan.blockingReasons.length === 0,
    plan,
    primaryBlockingReason,
    blockingReasons: [...plan.blockingReasons],
    warnings: [...plan.warnings],
    simulatedSteps,
  };
};