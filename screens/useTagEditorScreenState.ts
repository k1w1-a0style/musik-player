import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import type { Song } from '../types/Song';
import type { AppStackParamList } from '../types/navigation';
import type { EditableTrackTags, TagWriterErrorCode } from '../types/TagEdit';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { getTagEditCapability } from '../utils/tagEditCapability';
import { createTagWriteOperationPlan } from '../utils/tagWriteOrchestrator';
import { TagWriterError, writeTagsToFile } from '../utils/tagWriter';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import { pickTagEditorCover } from './tagEditorCoverPicker';
import {
  blockingReasonMessage,
  buildDraftFromDirtyFields,
  buildFormAfterSave,
  buildMetadataPatchFromDraft,
  capabilityReason,
  type FormState,
  hasRemovableCover,
  safetyNotice,
  statusMessage,
  tagWriterErrorMessage,
  toInitialForm,
} from './tagEditorHelpers';

type TagEditorRoute = RouteProp<AppStackParamList, 'TagEditor'>;

const EMPTY_SONG = { id: '', title: '', artist: '' } as Song;

export const useTagEditorScreenState = () => {
  const route = useRoute<TagEditorRoute>();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { songs, updateSongMetadata } = useLibraryMusicContext();
  const song = useMemo(
    () => songs.find(item => item.id === route.params.songId),
    [songs, route.params.songId],
  );
  const activeSongId = song?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [replacementCover, setReplacementCover] = useState<PickedTagCover | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toInitialForm(song ?? EMPTY_SONG));
  const [dirty, setDirty] = useState<Partial<Record<keyof EditableTrackTags, boolean>>>({});
  const activeSongRef = useRef(song);
  const coverPickGenerationRef = useRef(0);
  const saveGenerationRef = useRef(0);

  activeSongRef.current = song;

  useEffect(() => {
    const activeSong = activeSongRef.current;
    if (!activeSong) return;
    setForm(toInitialForm(activeSong));
    setDirty({});
    setRemoveCover(false);
    setReplacementCover(null);
    setStatus(null);
  }, [activeSongId]);

  const draft = song
    ? buildDraftFromDirtyFields(song.id, form, dirty, removeCover, replacementCover)
    : buildDraftFromDirtyFields('', form, dirty, removeCover, replacementCover);
  const capability = song ? getTagEditCapability(song) : getTagEditCapability(EMPTY_SONG);
  const plan = song ? createTagWriteOperationPlan(song, draft) : createTagWriteOperationPlan(EMPTY_SONG, draft);
  const hasCover = song ? hasRemovableCover(song) : false;
  const hasReplacementCover = Boolean(replacementCover);
  const hasChanges = Object.keys(draft.tags).length > 0 || draft.removeCover === true || hasReplacementCover;
  const canSave = Boolean(
    song && capability.canWrite && hasChanges && plan.blockingReasons.length === 0 && !saving,
  );
  const capabilityMessage = capability.canWrite ? undefined : capabilityReason(capability.reason);
  const blockedReasonMessage = blockingReasonMessage(
    plan.blockingReasons as TagWriterErrorCode[],
  );
  const safetyMessage = song ? safetyNotice(song) : undefined;

  const handlePickCover = async (): Promise<void> => {
    if (!song || !capability.canWrite || saving) return;

    const flowSongId = song.id;
    coverPickGenerationRef.current += 1;
    const generation = coverPickGenerationRef.current;
    const result = await pickTagEditorCover();
    const isStale =
      generation !== coverPickGenerationRef.current || activeSongRef.current?.id !== flowSongId;
    if (isStale) {
      console.warn('[CoverPicker] Ignoring stale cover picker result.', { songId: flowSongId });
      return;
    }

    setStatus(result.message);

    if (result.status !== 'selected') return;

    setReplacementCover(result.cover);
    setRemoveCover(false);
  };

  const handleChangeField = (key: keyof EditableTrackTags, value: string): void => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(prev => ({ ...prev, [key]: true }));
  };

  const toggleRemoveCover = (): void => {
    setReplacementCover(null);
    setRemoveCover(value => !value);
  };

  const onSaveConfirmed = async (): Promise<void> => {
    if (!song) return;

    const flowSongId = song.id;
    saveGenerationRef.current += 1;
    const generation = saveGenerationRef.current;
    setSaving(true);
    try {
      const result = await writeTagsToFile(song, draft);
      const isStale =
        generation !== saveGenerationRef.current || activeSongRef.current?.id !== flowSongId;
      if (isStale) {
        console.warn('[TrackInfo] Ignoring stale tag write result.', { songId: flowSongId });
        return;
      }

      if (result.status === 'written') {
        const metadataPatch = buildMetadataPatchFromDraft(draft, replacementCover);
        updateSongMetadata(song.id, metadataPatch);
        const updatedSong: Song = { ...song, ...metadataPatch };
        setForm(buildFormAfterSave(updatedSong, form, draft));
        setDirty({});
        setRemoveCover(false);
        setReplacementCover(null);
      } else if (result.status === 'noop') {
        setForm(current => buildFormAfterSave(song, current, draft));
        setDirty({});
        setRemoveCover(false);
        setReplacementCover(null);
      } else if (result.errorCode) {
        setStatus(tagWriterErrorMessage(result.errorCode, result.errorMessage));
        return;
      }
      setStatus(statusMessage(result));
    } catch (error) {
      console.warn('[TrackInfo] Tag save failed unexpectedly.', error);
      if (error instanceof TagWriterError) {
        setStatus(tagWriterErrorMessage(error.code, error.message));
      } else {
        setStatus('Speichern fehlgeschlagen.');
      }
    } finally {
      if (generation === saveGenerationRef.current) setSaving(false);
    }
  };

  return {
    song,
    form,
    saving,
    removeCover,
    replacementCover,
    status,
    capability,
    hasCover,
    canSave,
    capabilityMessage,
    blockedReasonMessage,
    safetyMessage,
    handlePickCover,
    handleChangeField,
    toggleRemoveCover,
    onSaveConfirmed,
    goBack: navigation.goBack,
  };
};
