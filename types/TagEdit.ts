export type TagEditableContainer = 'mp3' | 'm4a' | 'mp4' | 'unsupported';

export type TagEditUriType = 'file' | 'content' | 'remote' | 'empty' | 'unknown';

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
  albumArtist?: string;
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
  | 'FileTooLarge'
  | 'WriteNotImplemented'
  | 'WriteNotImplementedV22'
  | 'WriteNotImplementedV24'
  | 'BackupFailed'
  | 'TempWriteFailed'
  | 'ReplaceFailed'
  | 'RollbackFailed'
  | 'VerificationFailed';

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
  strategy: 'none' | 'sidecar-copy' | 'in-memory-original';
}

export interface WriteSafetyCapabilities {
  durableBackup: boolean;
  inMemoryRollback: boolean;
  atomicReplace: boolean;
  postWriteVerification: boolean;
  crashRecovery: boolean;
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
  safetyCapabilities: WriteSafetyCapabilities;
  requiresUserConfirmation: boolean;
  requiresFullRewrite: boolean;
  estimatedRisk: WriteRiskLevel;
  warnings: string[];
  blockingReasons: TagWriterErrorCode[];
}

export interface WriteOrchestrationResult {
  ok: boolean;
  plan: WriteOperationPlan;
  primaryBlockingReason?: TagWriterErrorCode;
  blockingReasons: TagWriterErrorCode[];
  warnings: string[];
  simulatedSteps: string[];
}

export type TagEditPlan = WriteOperationPlan;

export interface WriteTagsResult {
  status: 'written' | 'noop' | 'blocked' | 'rolledBack' | 'unsupportedUri' | 'permissionDenied' | 'writeFailed' | 'cancelled';
  sourceUri?: string;
  backupUri?: string;
  tempUri?: string;
  bytesBefore?: number;
  bytesAfter?: number;
  warnings: string[];
  errorCode?: TagWriterErrorCode;
  errorMessage?: string;
}

export type WritableTagUriResolution =
  | { ok: true; uri: string; source: 'fileInfo' | 'song'; uriType: Extract<TagEditUriType, 'file'> }
  | { ok: false; status: 'unsupportedUri' | 'permissionDenied'; reason: TagWriterErrorCode; message: string; source?: 'fileInfo' | 'song'; uriType: TagEditUriType };

export interface TagWritePayload {
  songId: string;
  uri: string;
  uriSource: 'fileInfo' | 'song';
  container: TagEditableContainer;
  draft: TagEditDraft;
}