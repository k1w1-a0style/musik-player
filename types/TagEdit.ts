export type TagEditableContainer = 'mp3' | 'm4a' | 'mp4' | 'unsupported';

export type TagEditUriType = 'file' | 'content' | 'remote' | 'unknown';

export interface TagEditCapability {
  canRead: boolean;
  canWrite: boolean;
  reason?: string;
  uriType: TagEditUriType;
  supportedContainer?: TagEditableContainer;
}

export interface EditableTrackTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  trackNumber?: string;
  discNumber?: string;
  comment?: string;
}

export interface EditableCover {
  mimeType: 'image/jpeg' | 'image/png';
  data: Uint8Array;
}

export interface TagEditDraft {
  songId: string;
  tags: EditableTrackTags;
  cover?: EditableCover | null;
  removeCover?: boolean;
}

export type TagWriterErrorCode =
  | 'UnsupportedFormat'
  | 'UnsupportedUri'
  | 'MissingWritePermission'
  | 'InvalidTagData'
  | 'WriteNotImplemented';

export type WriteRiskLevel = 'low' | 'medium' | 'high';

export interface WritePermissionState {
  canRead: boolean;
  canWrite: boolean;
  requiresSafPermission: boolean;
  reason?: string;
}

export interface BackupPlan {
  required: boolean;
  backupUri?: string;
  strategy: 'none' | 'sidecar-copy';
}

export interface AtomicWritePlan {
  required: boolean;
  tempUri?: string;
  supportsAtomicReplace: boolean;
}

export interface RollbackPlan {
  required: boolean;
  supportsRollback: boolean;
  steps: string[];
}

export interface WriteOperationPlan {
  sourceUri: string;
  targetUri: string;
  uriType: TagEditUriType;
  container: TagEditableContainer;
  permission: WritePermissionState;
  backup: BackupPlan;
  atomicWrite: AtomicWritePlan;
  rollback: RollbackPlan;
  requiresBackup: boolean;
  requiresTempFile: boolean;
  supportsAtomicReplace: boolean;
  supportsRollback: boolean;
  requiresUserConfirmation: boolean;
  requiresFullRewrite: boolean;
  estimatedRisk: WriteRiskLevel;
  warnings: string[];
  blockingReasons: TagWriterErrorCode[];
}

export interface WriteOrchestrationResult {
  ok: boolean;
  plan: WriteOperationPlan;
  blockingReasons: TagWriterErrorCode[];
  warnings: string[];
  simulatedSteps: string[];
}

export type TagEditPlan = WriteOperationPlan;
