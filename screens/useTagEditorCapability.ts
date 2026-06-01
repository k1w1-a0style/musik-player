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
    const canSave = Boolean(
      song && capability.canWrite && hasChanges && plan.blockingReasons.length === 0 && !saving,
    );
    const capabilityMessage = capability.canWrite ? undefined : capabilityReason(capability.reason);
    const blockedReasonMessage = blockingReasonMessage(plan.blockingReasons);
    const safetyMessage = song ? safetyNotice(song) : undefined;

    return {
      capability,
      plan,
      hasCover,
      canSave,
      capabilityMessage,
      blockedReasonMessage,
      safetyMessage,
    };
  }, [draft, hasChanges, saving, song]);
