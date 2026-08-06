import { useCallback } from 'react';
import type { TagEditDraft, TagEditableContainer, WriteTagsResult } from '../types/TagEdit';
import type { Song } from '../types/Song';
import { encodeBytesToBase64 } from '../utils/base64';
import { normalizeId3Genre } from '../utils/id3Parser';
import { TagWriterError, writeTagsToFile } from '../utils/tagWriter';
import { refreshSongsFromId3 } from '../utils/songMetadataRefresh';
import {
  shouldVerifyTagDeletionResult,
  verifyTagDeletionState,
} from '../utils/tagWriteVerification';
import type { FormState } from './tagEditorHelpers';
import {
  FIELDS,
  statusMessage,
  tagWriterErrorMessage,
} from './tagEditorHelpers';

const WRITE_REREAD_FAILED_MESSAGE = 'Datei wurde geschrieben, die Metadaten konnten aber nicht neu eingelesen werden.';
const WRITE_VERIFICATION_FAILED_MESSAGE = 'Datei wurde geschrieben, aber die erneute Prüfung hat nicht alle Änderungen bestätigt.';
const NOOP_DELETION_VERIFICATION_FAILED_MESSAGE = 'Die Löschung konnte in der Datei nicht bestätigt werden.';
const TAG_VERIFICATION_SCAN_BYTES = 8 * 1024 * 1024;
const WRITE_PENDING_MESSAGE = 'Speichern dauert länger als erwartet. Der geschützte Schreibvorgang läuft weiter; das Ergebnis wird beim nächsten App-Start abgeglichen.';

const writeFailureMessage = (result: WriteTagsResult): string => {
  if (result.operationPhase === 'pendingNativeResult' && result.terminal === false)
    return WRITE_PENDING_MESSAGE;
  if (result.errorCode) return tagWriterErrorMessage(result.errorCode, result.errorMessage);
  return 'Speichern fehlgeschlagen.';
};

const normalizeValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const normalizeExpectedValue = (
  container: TagEditableContainer,
  key: (typeof FIELDS)[number]['key'],
  value: unknown,
): string => {
  const normalized = normalizeValue(value);
  if (key !== 'genre' || container !== 'mp3') return normalized;
  return normalizeId3Genre(normalized) ?? '';
};

type TagVerificationSeedField = (typeof FIELDS)[number]['key'];

const clearTagVerificationSeedField = (
  seed: Song,
  key: TagVerificationSeedField,
): void => {
  switch (key) {
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
};

export const buildTagVerificationSeedSong = (song: Song, draft: TagEditDraft): Song => {
  const seed: Song = { ...song };
  const writtenUri = song.fileInfo?.uri?.trim() || song.uri?.trim();
  if (writtenUri) {
    seed.uri = writtenUri;
    seed.fileInfo = { ...song.fileInfo, uri: writtenUri };
  }

  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft.tags, field.key)) continue;
    clearTagVerificationSeedField(seed, field.key);
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
  container: TagEditableContainer,
): Partial<Song> | undefined => {
  const patch: Partial<Song> = {};
  for (const field of FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft.tags, field.key)) continue;
    const expected = normalizeExpectedValue(container, field.key, draft.tags[field.key]);
    const actual = normalizeValue(rereadSong[field.key]);
    if (actual !== expected) return undefined;
    if (before[field.key] !== rereadSong[field.key]) {
      (patch as Record<string, unknown>)[field.key] = rereadSong[field.key];
    }
  }

  if (draft.cover) {
    const verifiedCover = rereadSong.cover ?? rereadSong.coverInfo?.uri;
    const expectedCover = `data:${draft.cover.mimeType};base64,${encodeBytesToBase64(draft.cover.data)}`;
    if (verifiedCover !== expectedCover) return undefined;
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

const rereadWrittenSong = async (
  song: Song,
  draft: TagEditDraft,
  container: TagEditableContainer,
): Promise<Song | undefined> => {
  const verificationSeed = buildTagVerificationSeedSong(song, draft);
  const verifyCover = Boolean(draft.cover || draft.removeCover);
  const needsWideReadBounds = verifyCover || container === 'm4a' || container === 'mp4';
  const result = await refreshSongsFromId3([verificationSeed], {
    includeCover: verifyCover,
    concurrency: 1,
    disableNativeFastPath: true,
    ...(needsWideReadBounds
      ? {
          maxHeadBytes: TAG_VERIFICATION_SCAN_BYTES,
          maxTailBytes: TAG_VERIFICATION_SCAN_BYTES,
          maxFrameOffsetBytes: TAG_VERIFICATION_SCAN_BYTES,
          maxFrameBodyReadBytes: TAG_VERIFICATION_SCAN_BYTES,
        }
      : {}),
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
  container: TagEditableContainer;
  beginSaveFlow: (songId: string) => FlowToken;
  isSaveFlowStale: (token: FlowToken) => boolean;
  updateSongMetadata: (songId: string, metadataPatch: Partial<Song>) => void;
  setSaving: (saving: boolean) => void;
  setStatus: (status: string | null) => void;
  resetAfterWrittenSave: (updatedSong: Song, savedForm: FormState, savedDraft: TagEditDraft) => void;
  resetAfterNoopSave: (savedSong: Song, savedDraft: TagEditDraft) => void;
};

export const useTagEditorSaveFlow = ({
  song, draft, form, container, beginSaveFlow, isSaveFlowStale,
  updateSongMetadata, setSaving, setStatus, resetAfterWrittenSave, resetAfterNoopSave,
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

      if (shouldVerifyTagDeletionResult(result.status, draft)) {
        const deletionVerified = await verifyTagDeletionState(song, draft, container);
        if (isSaveFlowStale(token)) {
          console.warn('[TrackInfo] Ignoring stale tag deletion verification.', { songId: token.songId });
          return;
        }
        if (!deletionVerified) {
          setStatus(
            result.status === 'noop'
              ? NOOP_DELETION_VERIFICATION_FAILED_MESSAGE
              : WRITE_VERIFICATION_FAILED_MESSAGE,
          );
          return;
        }
      }

      if (result.status === 'written') {
        const rereadSong = await rereadWrittenSong(song, draft, container);
        if (isSaveFlowStale(token)) {
          console.warn('[TrackInfo] Ignoring stale tag re-read result.', { songId: token.songId });
          return;
        }
        if (!rereadSong) {
          setStatus(WRITE_REREAD_FAILED_MESSAGE);
          return;
        }
        const metadataPatch = buildVerifiedTagPatch(song, rereadSong, draft, container);
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
        setStatus(writeFailureMessage(result));
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
    beginSaveFlow, container, draft, form, isSaveFlowStale, resetAfterNoopSave,
    resetAfterWrittenSave, setSaving, setStatus, song, updateSongMetadata,
  ]);
