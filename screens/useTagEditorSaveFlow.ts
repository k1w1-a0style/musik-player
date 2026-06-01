import { useCallback } from 'react';
import type { TagEditDraft } from '../types/TagEdit';
import type { Song } from '../types/Song';
import { TagWriterError, writeTagsToFile } from '../utils/tagWriter';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import type { FormState } from './tagEditorHelpers';
import {
  buildMetadataPatchFromDraft,
  statusMessage,
  tagWriterErrorMessage,
} from './tagEditorHelpers';

type FlowToken = {
  generation: number;
  songId: string;
};

type UseTagEditorSaveFlowInput = {
  song?: Song;
  draft: TagEditDraft;
  form: FormState;
  replacementCover: PickedTagCover | null;
  beginSaveFlow: (songId: string) => FlowToken;
  isSaveFlowStale: (token: FlowToken) => boolean;
  updateSongMetadata: (songId: string, metadataPatch: Partial<Song>) => void;
  setSaving: (saving: boolean) => void;
  setStatus: (status: string | null) => void;
  resetAfterWrittenSave: (updatedSong: Song, savedForm: FormState, savedDraft: TagEditDraft) => void;
  resetAfterNoopSave: (savedSong: Song, savedDraft: TagEditDraft) => void;
};

export const useTagEditorSaveFlow = ({
  song,
  draft,
  form,
  replacementCover,
  beginSaveFlow,
  isSaveFlowStale,
  updateSongMetadata,
  setSaving,
  setStatus,
  resetAfterWrittenSave,
  resetAfterNoopSave,
}: UseTagEditorSaveFlowInput) =>
  useCallback(async (): Promise<void> => {
    if (!song) return;

    const token = beginSaveFlow(song.id);
    setSaving(true);

    try {
      const result = await writeTagsToFile(song, draft);
      if (isSaveFlowStale(token)) {
        console.warn('[TrackInfo] Ignoring stale tag write result.', { songId: token.songId });
        return;
      }

      if (result.status === 'written') {
        const metadataPatch = buildMetadataPatchFromDraft(draft, replacementCover);
        updateSongMetadata(song.id, metadataPatch);
        const updatedSong: Song = { ...song, ...metadataPatch };
        resetAfterWrittenSave(updatedSong, form, draft);
      } else if (result.status === 'noop') {
        resetAfterNoopSave(song, draft);
      } else if (result.errorCode) {
        setStatus(tagWriterErrorMessage(result.errorCode, result.errorMessage));
        return;
      }
      setStatus(statusMessage(result));
    } catch (error) {
      if (isSaveFlowStale(token)) {
        console.warn('[TrackInfo] Ignoring stale tag write error.', { songId: token.songId, error });
        return;
      }
      console.warn('[TrackInfo] Tag save failed unexpectedly.', error);
      if (error instanceof TagWriterError) {
        setStatus(tagWriterErrorMessage(error.code, error.message));
      } else {
        setStatus('Speichern fehlgeschlagen.');
      }
    } finally {
      if (!isSaveFlowStale(token)) {
        setSaving(false);
      }
    }
  }, [
    beginSaveFlow,
    draft,
    form,
    isSaveFlowStale,
    replacementCover,
    resetAfterNoopSave,
    resetAfterWrittenSave,
    setSaving,
    setStatus,
    song,
    updateSongMetadata,
  ]);
