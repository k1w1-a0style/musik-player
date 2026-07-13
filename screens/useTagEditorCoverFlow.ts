import { useCallback } from 'react';
import type { Song } from '../types/Song';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import { pickTagEditorCover } from './tagEditorCoverPicker';

type FlowToken = {
  generation: number;
  songId: string;
};

type UseTagEditorCoverFlowInput = {
  song?: Song;
  canPick: boolean;
  saving: boolean;
  beginCoverFlow: (songId: string) => FlowToken;
  isCoverFlowStale: (token: FlowToken) => boolean;
  setStatus: (status: string | null) => void;
  applyReplacementCover: (cover: PickedTagCover) => void;
};

export const useTagEditorCoverFlow = ({
  song,
  canPick,
  saving,
  beginCoverFlow,
  isCoverFlowStale,
  setStatus,
  applyReplacementCover,
}: UseTagEditorCoverFlowInput) =>
  useCallback(async (): Promise<void> => {
    if (!song || !canPick || saving) return;

    const token = beginCoverFlow(song.id);
    const result = await pickTagEditorCover();
    if (isCoverFlowStale(token)) {
      console.warn('[CoverPicker] Ignoring stale cover picker result.', { songId: token.songId });
      return;
    }

    setStatus(result.message);

    if (result.status !== 'selected') return;

    applyReplacementCover(result.cover);
  }, [applyReplacementCover, beginCoverFlow, canPick, isCoverFlowStale, saving, setStatus, song]);
