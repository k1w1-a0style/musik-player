import { useMemo } from 'react';
import type { TagEditDraft, WriteOperationPlan } from '../types/TagEdit';
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
    // Production plans always contain permission. The fallback keeps legacy
    // partial test doubles and defensive callers from crashing while the real
    // runtime plan still gates writes on the durable implementation contract.
    const planPermission = plan.permission;
    const planCanWrite = planPermission?.canWrite ?? capability.canWrite;
    const planPermissionReason = planPermission?.reason ?? capability.reason;
    const hasCover = song ? hasRemovableCover(song) : false;
    const canPickCover = Boolean(song && !saving);
    const coverUriType = plan.uriType ?? capability.uriType;
    const coverContainer = plan.container ?? capability.supportedContainer;
    const canWriteCover = Boolean(
      planCanWrite
      && (coverContainer === 'mp3' || coverContainer === 'm4a' || coverContainer === 'mp4')
      && (coverUriType === 'file' || coverUriType === 'content')
    );
    const hasPendingCoverWrite = Boolean(draft.cover || draft.removeCover);
    const coverWriteBlocked = hasPendingCoverWrite && !canWriteCover;
    const canSave = Boolean(
      song
      && planCanWrite
      && hasChanges
      && plan.blockingReasons.length === 0
      && !saving
      && !coverWriteBlocked,
    );
    const capabilityMessage = planCanWrite
      ? undefined
      : capabilityReason(planPermissionReason);
    const blockedReasonMessage = blockingReasonMessage(plan.blockingReasons, plan);
    const coverCapabilityMessage = canWriteCover
      ? undefined
      : 'Das Cover kann ausgewählt, für diese Dateiquelle aber noch nicht gespeichert werden.';
    const safetyMessage = resolveTagEditorSafetyMessage(
      song,
      plan,
      planCanWrite,
      planPermissionReason,
    );

    return {
      capability,
      plan,
      hasCover,
      canSave,
      canPickCover,
      canWriteCover,
      coverCapabilityMessage,
      capabilityMessage,
      blockedReasonMessage,
      safetyMessage,
    };
  }, [draft, hasChanges, saving, song]);
