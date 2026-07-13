import { useMemo } from 'react';
import type { TagEditDraft } from '../types/TagEdit';
import type { Song } from '../types/Song';
import { getTagEditCapability } from '../utils/tagEditCapability';
import { createTagWriteOperationPlan } from '../utils/tagWriteOrchestrator';
import {
  blockingReasonMessage,
  capabilityReason,
  hasRemovableCover,
  safetyNotice,
} from './tagEditorHelpers';

const EMPTY_SONG: Song = { id: '', title: '', artist: '' };

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
    const plan = createTagWriteOperationPlan(capabilitySong, draft);
    const hasCover = song ? hasRemovableCover(song) : false;
    const canPickCover = Boolean(song && !saving);
    const coverUriType = plan.uriType ?? capability.uriType;
    const coverContainer = plan.container ?? capability.supportedContainer;
    const canWriteCover = Boolean(
      capability.canWrite
      && (coverContainer === 'mp3' || coverContainer === 'm4a' || coverContainer === 'mp4')
      && (coverUriType === 'file' || coverUriType === 'content')
    );
    const hasPendingCoverWrite = Boolean(draft.cover || draft.removeCover);
    const coverWriteBlocked = hasPendingCoverWrite && !canWriteCover;
    const canSave = Boolean(
      song && capability.canWrite && hasChanges && plan.blockingReasons.length === 0 && !saving && !coverWriteBlocked,
    );
    const capabilityMessage = capability.canWrite ? undefined : capabilityReason(capability.reason);
    const blockedReasonMessage = blockingReasonMessage(plan.blockingReasons, plan);
    const coverCapabilityMessage = canWriteCover
      ? undefined
      : 'Das Cover kann ausgewählt, für diese Dateiquelle aber noch nicht gespeichert werden.';
    const safetyMessage = song ? safetyNotice(song) : undefined;

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
