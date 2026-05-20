import { useEffect, useMemo, useState } from 'react';
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
  const [saving, setSaving] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [replacementCover, setReplacementCover] = useState<PickedTagCover | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => toInitialForm(song ?? EMPTY_SONG));
  const [dirty, setDirty] = useState<Partial<Record<keyof EditableTrackTags, boolean>>>({});

  useEffect(() => {
    if (!song) return;
    setForm(toInitialForm(song));
    setDirty({});
    setRemoveCover(false);
    setReplacementCover(null);
    setStatus(null);
  }, [song?.id]);

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

    const result = await pickTagEditorCover();
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

    setSaving(true);
    try {
      const result = await writeTagsToFile(song, draft);
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
      }
      setStatus(statusMessage(result));
    } catch (error) {
      if (error instanceof TagWriterError) {
        setStatus(tagWriterErrorMessage(error.code, error.message));
      } else {
        setStatus('Speichern fehlgeschlagen.');
      }
    } finally {
      setSaving(false);
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
