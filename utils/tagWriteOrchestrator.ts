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

const buildFileRollbackSteps = (targetUri: string): string[] => [
  'Abort replacement before touching the original file when possible.',
  `Restore the durable sidecar backup to ${targetUri} if the guarded replace fails.`,
  'Verify restored bytes against the original before deleting backup and temp artifacts.',
];

const buildContentInMemoryRollbackSteps = (): string[] => [
  'Keep a copy of the original bytes in memory for the current process only.',
  'After a detected provider write failure, attempt to write those original bytes back to the document.',
  'This restoration attempt is not crash-safe and has no durable sidecar backup.',
  'No process-restart recovery or atomic replacement is available for this SAF write path.',
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

export const createRollbackPlan = (plan: WriteOperationPlan): RollbackPlan => {
  if (plan.safetyCapabilities.durableBackup && plan.backup.strategy === 'sidecar-copy') {
    return {
      required: true,
      supportsRollback: true,
      steps: buildFileRollbackSteps(plan.targetUri),
    };
  }

  if (plan.safetyCapabilities.inMemoryRollback) {
    return {
      required: true,
      supportsRollback: false,
      steps: buildContentInMemoryRollbackSteps(),
    };
  }

  return { required: false, supportsRollback: false, steps: [] };
};

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
      required: uriType === 'file' && capability.canWrite,
      backupUri: uriType === 'file' && capability.canWrite && safeUri ? `${safeUri}.bak` : undefined,
      strategy: uriType === 'file' && capability.canWrite ? 'sidecar-copy' : 'none',
    },
    atomicWrite: {
      required: uriType === 'file' && capability.canWrite,
      tempUri: uriType === 'file' && capability.canWrite && safeUri ? `${safeUri}.tmp` : undefined,
      supportsAtomicReplace: false,
    },
    rollback: { required: false, supportsRollback: false, steps: [] },
    requiresBackup: uriType === 'file' && capability.canWrite,
    requiresTempFile: uriType === 'file' && capability.canWrite,
    supportsAtomicReplace: false,
    supportsRollback: uriType === 'file' && capability.canWrite,
    safetyCapabilities: {
      durableBackup: uriType === 'file' && capability.canWrite,
      inMemoryRollback: uriType === 'content' && capability.canWrite && container !== 'unsupported',
      atomicReplace: false,
      postWriteVerification: capability.canWrite && (uriType === 'file' || uriType === 'content'),
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
    plan.backup.strategy === 'sidecar-copy'
      ? 'Would create a durable sidecar backup before file replacement.'
      : plan.safetyCapabilities.inMemoryRollback
        ? 'Would keep an in-memory copy of the original bytes for the current process only.'
        : 'No backup or in-memory rollback step is available.',
    plan.requiresTempFile
      ? 'Would write output to temp file first.'
      : 'No temp file required.',
    plan.safetyCapabilities.postWriteVerification
      ? 'Would verify written bytes after the concrete writer completes.'
      : 'No post-write verification is available because no writable implementation is available.',
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