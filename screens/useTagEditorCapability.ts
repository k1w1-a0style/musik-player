import { useMemo } from 'react';
import type { TagEditCapability, TagEditDraft, TagEditableContainer, TagEditUriType, WriteOperationPlan } from '../types/TagEdit';
import type { Song } from '../types/Song';
import { getTagEditCapability } from '../utils/tagEditCapability';
import { prepareTagEditPlan } from '../utils/tagWriterPublicApi';
import {
  blockingReasonMessage,
  capabilityReason,
  hasRemovableCover,
  safetyNotice,
} from './tagEditorHelpers';

const EMPTY_SONG: Song = { id: '', title: '', artist: '' };
const COVER_WRITE_CONTAINERS: ReadonlySet<TagEditableContainer> = new Set(['mp3', 'm4a', 'mp4']);
const COVER_WRITE_URI_TYPES: ReadonlySet<TagEditUriType> = new Set(['file', 'content']);

const resolveTagEditorSafetyMessage = (
  song: Song | undefined,
  plan: Pick<WriteOperationPlan, 'uriType'>,
  canWrite: boolean,
  permissionReason?: string,
): string | undefined => {
  if (!song) return undefined;
  if (plan.uriType === 'file' && !canWrite) return capabilityReason(permissionReason);
  return safetyNotice(song);
};

const resolvePlanPermission = (
  capability: TagEditCapability,
  plan: WriteOperationPlan,
): { canWrite: boolean; reason?: string } => ({
  // Production plans always contain permission. The fallback keeps legacy
  // partial test doubles and defensive callers from crashing while the real
  // runtime plan still gates writes on the durable implementation contract.
  canWrite: plan.permission?.canWrite ?? capability.canWrite,
  reason: plan.permission?.reason ?? capability.reason,
});

const canWriteCoverForPlan = (
  canWrite: boolean,
  capability: TagEditCapability,
  plan: WriteOperationPlan,
): boolean => {
  const container = plan.container ?? capability.supportedContainer;
  const uriType = plan.uriType ?? capability.uriType;
  return canWrite && COVER_WRITE_CONTAINERS.has(container) && COVER_WRITE_URI_TYPES.has(uriType);
};

const canSaveTagEdit = (
  song: Song | undefined,
  plan: WriteOperationPlan,
  canWrite: boolean,
  hasChanges: boolean,
  saving: boolean,
  coverWriteBlocked: boolean,
): boolean => Boolean(
  song
  && canWrite
  && hasChanges
  && plan.blockingReasons.length === 0
  && !saving
  && !coverWriteBlocked,
);

type UseTagEditorCapabilityInput = {
  song?: Song;
  draft: TagEditDraft;
  hasChanges: boolean;
  saving: boolean;
};

export const useTagEditorCapability = ({
  song,
  draft,
  hasChanges,
  saving,
}: UseTagEditorCapabilityInput) =>
  useMemo(() => {
    const capabilitySong = song ?? EMPTY_SONG;
    const capability = getTagEditCapability(capabilitySong);
    const plan = prepareTagEditPlan(capabilitySong, draft);
    const permission = resolvePlanPermission(capability, plan);
    const hasCover = song ? hasRemovableCover(song) : false;
    const canPickCover = Boolean(song && !saving);
    const canWriteCover = canWriteCoverForPlan(permission.canWrite, capability, plan);
    const coverWriteBlocked = Boolean(draft.cover || draft.removeCover) && !canWriteCover;

    return {
      capability,
      plan,
      hasCover,
      canSave: canSaveTagEdit(song, plan, permission.canWrite, hasChanges, saving, coverWriteBlocked),
      canPickCover,
      canWriteCover,
      coverCapabilityMessage: canWriteCover
        ? undefined
        : 'Das Cover kann ausgewählt, für diese Dateiquelle aber noch nicht gespeichert werden.',
      capabilityMessage: permission.canWrite ? undefined : capabilityReason(permission.reason),
      blockedReasonMessage: blockingReasonMessage(plan.blockingReasons, plan),
      safetyMessage: resolveTagEditorSafetyMessage(song, plan, permission.canWrite, permission.reason),
    };
  }, [draft, hasChanges, saving, song]);
