import type { TagWriterErrorCode, WriteOperationPlan } from '../../types/TagEdit';

const BLOCKING_REASON_PRIORITY: TagWriterErrorCode[] = [
  'FileTooLarge',
  'InvalidTagData',
  'UnsupportedUri',
  'UnsupportedFormat',
  'MissingWritePermission',
  'WriteNotImplemented',
];

export const getPrimaryBlockingReason = (
  plan: WriteOperationPlan,
): TagWriterErrorCode | undefined =>
  BLOCKING_REASON_PRIORITY.find(reason => plan.blockingReasons.includes(reason));

export const assertSafeWriteAllowed = (
  plan: WriteOperationPlan,
): TagWriterErrorCode | null => getPrimaryBlockingReason(plan) ?? null;

export const simulateTagWriteOperation = (plan: WriteOperationPlan) => {
  const primaryBlockingReason = getPrimaryBlockingReason(plan);
  const simulatedSteps = [
    `Plan created for ${plan.container} at ${plan.targetUri || '<missing-uri>'}.`,
    plan.backup.strategy === 'app-private-transaction-backup'
      ? 'Would create a durable app-private SAF transaction backup before provider write.'
      : plan.backup.strategy === 'sidecar-copy'
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
      ? 'Durable backup would be available before the final write.'
      : 'No durable backup is available for this URI type.',
    plan.supportsRollback
      ? 'Rollback is available if the provider write fails.'
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
