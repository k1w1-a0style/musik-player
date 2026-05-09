import type { Song } from '../types/Song';
import type { TagEditDraft, TagWriterErrorCode, WriteOperationPlan, RollbackPlan, WriteOrchestrationResult, TagEditableContainer } from '../types/TagEdit';
import { getTagEditCapability, getSupportedContainer, getUriType } from './tagEditCapability';
import { validateCoverPayload, validateEditableTags } from './tagValidation';

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

const getPrimaryBlockingReason = (reasons: TagWriterErrorCode[]): TagWriterErrorCode | undefined => {
  const priority: TagWriterErrorCode[] = [
    'InvalidTagData',
    'UnsupportedUri',
    'UnsupportedFormat',
    'MissingWritePermission',
    'WriteNotImplemented',
  ];
  return priority.find(reason => reasons.includes(reason));
};

const containerWarning = (container: TagEditableContainer): string | undefined => {
  if (container === 'mp3') return 'MP3 writer remains disabled; orchestration is dry-run only.';
  if (container === 'm4a' || container === 'mp4') return 'MP4/M4A writer remains disabled; orchestration is dry-run only.';
  return undefined;
};

export const validateWritePreconditions = (song: Song, draft: TagEditDraft): TagWriterErrorCode[] => {
  const errors: TagWriterErrorCode[] = [];
  const uri = song.fileInfo?.uri ?? song.uri;
  const container = getSupportedContainer(song);
  const uriType = getUriType(uri);
  const normalized = { ...draft, cover: draft.removeCover ? undefined : draft.cover };

  const tagValidation = validateEditableTags(normalized.tags);
  if (!tagValidation.valid || !validateCoverPayload(normalized.cover)) errors.push('InvalidTagData');
  if (!uri || uriType === 'unknown' || uriType === 'remote') errors.push('UnsupportedUri');
  if (container === 'unsupported') errors.push('UnsupportedFormat');
  if (uriType === 'content') errors.push('MissingWritePermission');
  if (container !== 'unsupported' && uriType !== 'remote' && uriType !== 'unknown') errors.push('WriteNotImplemented');

  return [...new Set(errors)];
};

export const createRollbackPlan = (plan: WriteOperationPlan): RollbackPlan => ({
  required: plan.requiresBackup || plan.requiresTempFile,
  supportsRollback: plan.uriType === 'file',
  steps: buildRollbackSteps(plan.targetUri),
});

export const createTagWriteOperationPlan = (song: Song, draft: TagEditDraft): WriteOperationPlan => {
  const uri = song.fileInfo?.uri ?? song.uri;
  const safeUri = uri ?? '';
  const capability = getTagEditCapability(song);
  const container = getSupportedContainer(song);
  const uriType = getUriType(uri);
  const warnings = [...(capability.reason ? [capability.reason] : [])];
  const containerWarn = containerWarning(container);
  if (containerWarn) warnings.push(containerWarn);
  if (draft.removeCover && draft.cover) warnings.push('removeCover=true takes precedence over cover payload.');
  if (uriType === 'content') warnings.push('SAF providers may not guarantee atomic replace semantics.');
  if (uriType === 'file') warnings.push('Future file:// writes must use backup + temp + validated replace only.');

  const blockingReasons = validateWritePreconditions(song, draft);
  const plan: WriteOperationPlan = {
    sourceUri: safeUri,
    targetUri: safeUri,
    uriType,
    container,
    permission: {
      canRead: capability.canRead,
      canWrite: false,
      requiresSafPermission: uriType === 'content',
      reason: capability.reason,
    },
    backup: {
      required: uriType === 'file' || uriType === 'content',
      backupUri: safeUri ? `${safeUri}.bak` : undefined,
      strategy: uriType === 'file' || uriType === 'content' ? 'sidecar-copy' : 'none',
    },
    atomicWrite: {
      required: uriType === 'file' || uriType === 'content',
      tempUri: safeUri ? `${safeUri}.tmp` : undefined,
      supportsAtomicReplace: uriType === 'file',
    },
    rollback: { required: false, supportsRollback: false, steps: [] },
    requiresBackup: uriType === 'file' || uriType === 'content',
    requiresTempFile: uriType === 'file' || uriType === 'content',
    supportsAtomicReplace: uriType === 'file',
    supportsRollback: uriType === 'file',
    requiresUserConfirmation: uriType === 'content' || getRiskLevel(uriType) === 'high',
    requiresFullRewrite: container !== 'unsupported',
    estimatedRisk: getRiskLevel(uriType),
    warnings,
    blockingReasons,
  };
  plan.rollback = createRollbackPlan(plan);
  return plan;
};

export const assertSafeWriteAllowed = (plan: WriteOperationPlan): void => {
  const primary = getPrimaryBlockingReason(plan.blockingReasons);
  if (primary) throw new Error(`Write blocked: ${primary}`);
};

export const simulateTagWriteOperation = (plan: WriteOperationPlan): WriteOrchestrationResult => {
  const simulatedSteps = [
    `Plan created for ${plan.container} at ${plan.targetUri || '<missing-uri>'}.`,
    plan.requiresBackup ? 'Would create backup sidecar before any write.' : 'No backup step required.',
    plan.requiresTempFile ? 'Would write output to temp file first.' : 'No temp file required.',
    'Would validate written output metadata before replace step.',
    plan.supportsAtomicReplace ? 'Would perform atomic replace.' : 'Atomic replace not guaranteed; would require guarded fallback.',
    plan.supportsRollback ? 'Rollback strategy is available if replace fails.' : 'Rollback guarantee is limited for this URI type.',
    'Dry-run only: no filesystem mutation performed.',
  ];

  return {
    ok: plan.blockingReasons.length === 0,
    plan,
    blockingReasons: [...plan.blockingReasons],
    warnings: [...plan.warnings],
    simulatedSteps,
  };
};
