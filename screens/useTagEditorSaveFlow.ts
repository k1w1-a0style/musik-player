import { useCallback } from 'react';
import type { TagEditDraft } from '../types/TagEdit';
import type { Song } from '../types/Song';
import { TagWriterError, writeTagsToFile } from '../utils/tagWriter';
import { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import type { FormState } from './tagEditorHelpers';
import {
  FIELDS,
  statusMessage,
  tagWriterErrorMessage,
} from './tagEditorHelpers';

const WRITE_REREAD_FAILED_MESSAGE = 'Datei wurde geschrieben, die Metadaten konnten aber nicht neu eingelesen werden.';
const WRITE_VERIFICATION_FAILED_MESSAGE = 'Datei wurde geschrieben, aber die erneute Prüfung hat nicht alle Änderungen bestätigt.';

const normalizeValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export const buildTagVerificationSeedSong = (song: Song, draft: TagEditDraft): Song => {
  const seed: Song = { ...song };

  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft.tags, field.key)) continue;
    switch (field.key) {
      case 'title':
        seed.title = '';
        break;
      case 'artist':
        seed.artist = '';
        break;
      case 'albumArtist':
        seed.albumArtist = undefined;
        break;
      case 'album':
        seed.album = undefined;
        break;
      case 'year':
        seed.year = undefined;
        break;
      case 'genre':
        seed.genre = undefined;
        break;
      case 'trackNumber':
        seed.trackNumber = undefined;
        break;
      case 'discNumber':
        seed.discNumber = undefined;
        break;
      case 'comment':
        seed.comment = undefined;
        break;
    }
  }

  if (draft.cover || draft.removeCover) {
    seed.cover = undefined;
    seed.coverInfo = undefined;
  }

  return seed;
};

export const buildVerifiedTagPatch = (
  before: Song,
  rereadSong: Song,
  draft: TagEditDraft,
): Partial<Song> | undefined => {
  const patch: Partial<Song> = {};
  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft.tags, field.key)) continue;
    const expected = normalizeValue(draft.tags[field.key]);
    const actual = normalizeValue(rereadSong[field.key]);
    if (actual !== expected) return undefined;
    if (before[field.key] !== rereadSong[field.key]) {
      (patch as Record<string, unknown>)[field.key] = rereadSong[field.key];
    }
  }

  if (draft.cover) {
    const verifiedCover = rereadSong.coverInfo?.uri ?? rereadSong.cover;
    if (!verifiedCover) return undefined;
    patch.cover = rereadSong.cover;
    patch.coverInfo = rereadSong.coverInfo;
  } else if (draft.removeCover) {
    const verifiedCover = rereadSong.coverInfo?.uri ?? rereadSong.cover;
    if (verifiedCover) return undefined;
    patch.cover = undefined;
    patch.coverInfo = undefined;
  }

  return patch;
};

const rereadWrittenSong = async (song: Song, draft: TagEditDraft): Promise<Song | undefined> => {
  const verificationSeed = buildTagVerificationSeedSong(song, draft);
  const result = await refreshSongsFromId3([verificationSeed], {
    includeCover: true,
    concurrency: 1,
    disableNativeFastPath: true,
  });
  if (result.failed > 0 || result.songs.length !== 1) return undefined;
  return result.songs[0];
};

type FlowToken = {
  generation: number;
  songId: string;
};

type UseTagEditorSaveFlowInput = {
  song?: Song;
  draft: TagEditDraft;
  form: FormState;
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
        const rereadSong = await rereadWrittenSong(song, draft);
        if (isSaveFlowStale(token)) {
          console.warn('[TrackInfo] Ignoring stale tag re-read result.', { songId: token.songId });
          return;
        }
        if (!rereadSong) {
          setStatus(WRITE_REREAD_FAILED_MESSAGE);
          return;
        }
        const metadataPatch = buildVerifiedTagPatch(song, rereadSong, draft);
        if (!metadataPatch) {
          setStatus(WRITE_VERIFICATION_FAILED_MESSAGE);
          return;
        }
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
    resetAfterNoopSave,
    resetAfterWrittenSave,
    setSaving,
    setStatus,
    song,
    updateSongMetadata,
  ]);
