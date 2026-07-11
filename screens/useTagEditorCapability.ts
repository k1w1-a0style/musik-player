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
    const blockedReasonMessage = blockingReasonMessage(plan.blockingReasons, plan);
    const coverUriType = plan.uriType ?? capability.uriType;
    const coverContainer = plan.container ?? capability.supportedContainer;
    const canWriteCover = Boolean(
      capability.canWrite
      && coverUriType === 'file'
      && (coverContainer === 'mp3' || coverContainer === 'm4a' || coverContainer === 'mp4'),
    );
    const coverCapabilityMessage = canWriteCover || !capability.canWrite
      ? undefined
      : coverUriType === 'content'
        ? 'Cover-Auswahl ist für SAF/content:// nur Vorschau; Cover-Schreiben ist noch nicht unterstützt.'
        : coverContainer === 'm4a' || coverContainer === 'mp4'
          ? 'Cover-Auswahl ist für MP4/M4A in dieser Version nicht speicherbar.'
          : undefined;
    const safetyMessage = song ? safetyNotice(song) : undefined;

    return {
      capability,
      plan,
      hasCover,
      canSave,
      canWriteCover,
      coverCapabilityMessage,
      capabilityMessage,
      blockedReasonMessage,
      safetyMessage,
    };
  }, [draft, hasChanges, saving, song]);
