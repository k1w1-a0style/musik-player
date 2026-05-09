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

export interface TagEditPlan {
  uri: string;
  uriType: TagEditUriType;
  container: TagEditableContainer;
  requiresBackup: boolean;
  requiresFullRewrite: boolean;
  estimatedRisk: 'low' | 'medium' | 'high';
  warnings: string[];
}
