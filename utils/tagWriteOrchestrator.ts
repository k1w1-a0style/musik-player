import type { Song } from '../types/Song';
import type {
  TagEditDraft,
  TagWriterErrorCode,
  WriteOperationPlan,
  RollbackPlan,
  TagEditableContainer,
} from '../types/TagEdit';
import {
  getTagEditCapability,
  getSupportedContainer,
  getUriType,
} from './tagEditCapability';
import { validateCoverPayload, validateEditableTags } from './tagValidation';
import {
  classifyTagWriteMaxFileSizeBytes,
  DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES,
} from './tagWriterLimits';

export { DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES } from './tagWriterLimits';

export type TagWriteRuntimeAvailability = {
  /**
   * True only when the loaded Android native module exposes the complete
   * durable SAF transaction and recovery contract. Source-level SAF support is
   * not sufficient for advertising backup or crash-recovery guarantees.
   */
  safDurableWriterAvailable?: boolean;
};

const buildFileRollbackSteps = (targetUri: string): string[] => [
  'Abort replacement before touching the original file when possible.',
  `Restore the durable sidecar backup to ${targetUri} if the guarded replace fails.`,
  'Verify restored bytes against the original before deleting backup and temp artifacts.',
];

const buildContentTransactionRollbackSteps = (): string[] => [
  'Create a durable app-private transaction backup before touching the SAF document.',
  'After a detected provider write failure, stream original.bin back to the document.',
  'Verify restored bytes before deleting transaction artifacts.',
  'Keep unresolved backups for process-restart recovery when restoration cannot be verified.',
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

const containerWarning = (
  container: TagEditableContainer,
  uriType: string,
  concreteWriterAvailable: boolean,
): string | undefined => {
  if (container !== 'mp3' && container !== 'm4a' && container !== 'mp4') return undefined;
  if (uriType === 'content' && concreteWriterAvailable) {
    return 'SAF content:// writes use native permission checks, app-private transaction backup, rollback, crash recovery, and post-write verification.';
  }
  if (uriType === 'file' && concreteWriterAvailable) {
    return 'MP3/M4A/MP4 file:// writes use guarded backup, temp staging, and byte verification.';
  }
  return undefined;
};

const getKnownFileSize = (song: Song): number | undefined => {
  const size = song.fileInfo?.size;
  return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
};

const hasConcreteWriter = (
  uriType: string,
  sourceCanWrite: boolean,
  runtime: TagWriteRuntimeAvailability,
): boolean => {
  if (!sourceCanWrite) return false;
  if (uriType !== 'content') return true;
  return runtime.safDurableWriterAvailable === true;
};

const validateDraftAndTarget = (
  uri: string | undefined,
  uriType: string,
  container: TagEditableContainer,
  draft: TagEditDraft,
): TagWriterErrorCode[] => {
  const normalized = { ...draft, cover: draft.removeCover ? undefined : draft.cover };
  const tagValidation = validateEditableTags(normalized.tags);
  const errors: TagWriterErrorCode[] = [];
  if (!tagValidation.valid || !validateCoverPayload(normalized.cover))
    errors.push('InvalidTagData');
  if (!uri || ['empty', 'unknown', 'remote'].includes(uriType))
    errors.push('UnsupportedUri');
  if (container === 'unsupported') errors.push('UnsupportedFormat');
  return errors;
};

const validateWriterAndSize = (
  uriType: string,
  container: TagEditableContainer,
  concreteWriterAvailable: boolean,
  knownFileSize: number | undefined,
  maxFileSizeBytes: number,
): TagWriterErrorCode[] => {
  const errors: TagWriterErrorCode[] = [];
  const sizeLimitError = classifyTagWriteMaxFileSizeBytes(maxFileSizeBytes);
  if (sizeLimitError) errors.push(sizeLimitError);
  if (!sizeLimitError && knownFileSize !== undefined && knownFileSize > maxFileSizeBytes)
    errors.push('FileTooLarge');
  const supportedFileTarget = uriType === 'file' && container !== 'unsupported';
  if ((uriType === 'content' || supportedFileTarget) && !concreteWriterAvailable)
    errors.push('WriteNotImplemented');
  return errors;
};

export const validateWritePreconditions = (
  song: Song,
  draft: TagEditDraft,
  platform?: string,
  maxFileSizeBytes = DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES,
  runtime: TagWriteRuntimeAvailability = {},
): TagWriterErrorCode[] => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const capability = getTagEditCapability(song, platform);
  const container = getSupportedContainer(song);
  const uriType = getUriType(uri);
  const concreteWriterAvailable = hasConcreteWriter(uriType, capability.canWrite, runtime);
  const knownFileSize = getKnownFileSize(song);
  return [...new Set([
    ...validateDraftAndTarget(uri, uriType, container, draft),
    ...validateWriterAndSize(
      uriType,
      container,
      concreteWriterAvailable,
      knownFileSize,
      maxFileSizeBytes,
    ),
  ])];
};

export const createRollbackPlan = (plan: WriteOperationPlan): RollbackPlan => {
  if (plan.safetyCapabilities.durableBackup && (plan.backup.strategy === 'sidecar-copy' || plan.backup.strategy === 'app-private-transaction-backup')) {
    return {
      required: true,
      supportsRollback: true,
      steps: plan.backup.strategy === 'app-private-transaction-backup'
        ? buildContentTransactionRollbackSteps()
        : buildFileRollbackSteps(plan.targetUri),
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

interface TagWritePlanContext {
  safeUri: string;
  uriType: WriteOperationPlan['uriType'];
  container: WriteOperationPlan['container'];
  concreteWriterAvailable: boolean;
  permissionReason?: string;
  knownFileSize?: number;
  maxFileSizeBytes: number;
}

const buildTagWriteWarnings = (
  draft: TagEditDraft,
  context: TagWritePlanContext,
): string[] => {
  const warnings = context.permissionReason ? [context.permissionReason] : [];
  const containerWarn = containerWarning(
    context.container,
    context.uriType,
    context.concreteWriterAvailable,
  );
  if (containerWarn) warnings.push(containerWarn);
  if (draft.removeCover && draft.cover) warnings.push('removeCover=true takes precedence over cover payload.');
  if (typeof context.knownFileSize === 'number' && context.knownFileSize > context.maxFileSizeBytes) {
    warnings.push(
      `File is larger than ${Math.round(context.maxFileSizeBytes / (1024 * 1024))} MB, so in-app tag writing is blocked before reading bytes.`,
    );
  }
  if (context.uriType === 'content') {
    warnings.push(context.concreteWriterAvailable
      ? 'SAF/content:// writes require native ContentResolver write permission, provider writable flags, app-private transaction backup, rollback, crash recovery, and post-write verification; they do not provide atomic replacement.'
      : 'SAF/content:// writing is blocked because the loaded native build does not expose the complete durable transaction and recovery contract.');
  }
  if (context.uriType === 'file') {
    warnings.push(
      'file:// writes use backup + temp + byte verification; the final replace is guarded but not guaranteed OS-atomic.',
    );
  }
  return warnings;
};

type TagWriteArtifacts = {
  supportsConcreteWrite: boolean;
  supportsCrashRecovery: boolean;
  backup: WriteOperationPlan['backup'];
  tempUri?: string;
};

const buildTagWriteArtifacts = (context: TagWritePlanContext): TagWriteArtifacts => {
  if (!context.concreteWriterAvailable) {
    return {
      supportsConcreteWrite: false,
      supportsCrashRecovery: false,
      backup: { required: false, strategy: 'none' },
    };
  }
  if (context.uriType === 'content') {
    return {
      supportsConcreteWrite: true,
      supportsCrashRecovery: context.container !== 'unsupported',
      backup: { required: true, strategy: 'app-private-transaction-backup' },
    };
  }
  if (context.uriType === 'file') {
    return {
      supportsConcreteWrite: true,
      supportsCrashRecovery: false,
      backup: {
        required: true,
        backupUri: context.safeUri ? `${context.safeUri}.bak` : undefined,
        strategy: 'sidecar-copy',
      },
      tempUri: context.safeUri ? `${context.safeUri}.tmp` : undefined,
    };
  }
  return {
    supportsConcreteWrite: false,
    supportsCrashRecovery: false,
    backup: { required: false, strategy: 'none' },
  };
};

const buildTagWritePlan = ({
  safeUri,
  uriType,
  container,
  concreteWriterAvailable,
  permissionReason,
  warnings,
  blockingReasons,
  canRead,
  ...context
}: TagWritePlanContext & {
  warnings: string[];
  blockingReasons: TagWriterErrorCode[];
  canRead: boolean;
}): WriteOperationPlan => {
  const artifacts = buildTagWriteArtifacts({
    safeUri,
    uriType,
    container,
    concreteWriterAvailable,
    permissionReason,
    ...context,
  });
  const risk = getRiskLevel(uriType);
  return {
    sourceUri: safeUri,
    targetUri: safeUri,
    uriType,
    container,
    permission: {
      canRead,
      canWrite: concreteWriterAvailable,
      requiresSafPermission: uriType === 'content',
      reason: permissionReason,
    },
    backup: artifacts.backup,
    atomicWrite: {
      required: artifacts.supportsConcreteWrite,
      tempUri: artifacts.tempUri,
      supportsAtomicReplace: false,
    },
    rollback: { required: false, supportsRollback: false, steps: [] },
    requiresBackup: artifacts.supportsConcreteWrite,
    requiresTempFile: artifacts.supportsConcreteWrite,
    supportsAtomicReplace: false,
    supportsRollback: artifacts.supportsConcreteWrite,
    safetyCapabilities: {
      durableBackup: artifacts.supportsConcreteWrite,
      inMemoryRollback: false,
      atomicReplace: false,
      postWriteVerification: artifacts.supportsConcreteWrite,
      crashRecovery: artifacts.supportsCrashRecovery,
    },
    requiresUserConfirmation: uriType === 'content' || risk === 'high',
    requiresFullRewrite: container !== 'unsupported',
    estimatedRisk: risk,
    warnings,
    blockingReasons,
  };
};

export const createTagWriteOperationPlan = (
  song: Song,
  draft: TagEditDraft,
  platform?: string,
  maxFileSizeBytes = DEFAULT_MAX_SAFE_TAG_WRITE_FILE_BYTES,
  runtime: TagWriteRuntimeAvailability = {},
): WriteOperationPlan => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const safeUri = uri ?? '';
  const capability = getTagEditCapability(song, platform);
  const container = getSupportedContainer(song);
  const uriType = getUriType(uri);
  const concreteWriterAvailable = hasConcreteWriter(uriType, capability.canWrite, runtime);
  const unavailableWriterReason = uriType === 'content' && capability.canWrite && !concreteWriterAvailable
    ? 'Der geladene Android-Native-Build enthält nicht den vollständigen dauerhaften SAF-Transaktions- und Recovery-Writer.'
    : undefined;
  const permissionReason = unavailableWriterReason ?? capability.reason;
  const context: TagWritePlanContext = {
    safeUri,
    uriType,
    container,
    concreteWriterAvailable,
    permissionReason,
    knownFileSize: getKnownFileSize(song),
    maxFileSizeBytes,
  };
  const plan = buildTagWritePlan({
    ...context,
    warnings: buildTagWriteWarnings(draft, context),
    blockingReasons: validateWritePreconditions(song, draft, platform, maxFileSizeBytes, runtime),
    canRead: capability.canRead,
  });
  plan.rollback = createRollbackPlan(plan);
  return plan;
};
