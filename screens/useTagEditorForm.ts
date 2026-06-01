import { useCallback, useMemo, useState } from 'react';
import type { EditableTrackTags, TagEditDraft } from '../types/TagEdit';
import type { Song } from '../types/Song';
import type { PickedTagCover } from '../utils/tagCoverPicker';
import {
  buildDraftFromDirtyFields,
  buildFormAfterSave,
  type FormState,
  toInitialForm,
} from './tagEditorHelpers';

const EMPTY_FORM_SONG: Song = { id: '', title: '', artist: '' };

type DirtyState = Partial<Record<keyof EditableTrackTags, boolean>>;

export const useTagEditorForm = (song: Song | undefined) => {
  const [form, setForm] = useState<FormState>(() => toInitialForm(song ?? EMPTY_FORM_SONG));
  const [dirty, setDirty] = useState<DirtyState>({});
  const [removeCover, setRemoveCover] = useState(false);
  const [replacementCover, setReplacementCover] = useState<PickedTagCover | null>(null);

  const resetForSong = useCallback((nextSong: Song): void => {
    setForm(toInitialForm(nextSong));
    setDirty({});
    setRemoveCover(false);
    setReplacementCover(null);
  }, []);

  const resetCoverDraft = useCallback((): void => {
    setDirty({});
    setRemoveCover(false);
    setReplacementCover(null);
  }, []);

  const handleChangeField = useCallback((key: keyof EditableTrackTags, value: string): void => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(prev => ({ ...prev, [key]: true }));
  }, []);

  const toggleRemoveCover = useCallback((): void => {
    setReplacementCover(null);
    setRemoveCover(value => !value);
  }, []);

  const applyReplacementCover = useCallback((cover: PickedTagCover): void => {
    setReplacementCover(cover);
    setRemoveCover(false);
  }, []);

  const draft = useMemo(
    () => buildDraftFromDirtyFields(song?.id ?? '', form, dirty, removeCover, replacementCover),
    [dirty, form, removeCover, replacementCover, song?.id],
  );

  const hasChanges = useMemo(
    () =>
      Object.keys(draft.tags).length > 0 ||
      draft.removeCover === true ||
      Boolean(replacementCover),
    [draft, replacementCover],
  );

  const resetAfterWrittenSave = useCallback(
    (updatedSong: Song, savedForm: FormState, savedDraft: TagEditDraft): void => {
      setForm(buildFormAfterSave(updatedSong, savedForm, savedDraft));
      resetCoverDraft();
    },
    [resetCoverDraft],
  );

  const resetAfterNoopSave = useCallback((savedSong: Song, savedDraft: TagEditDraft): void => {
    setForm(current => buildFormAfterSave(savedSong, current, savedDraft));
    resetCoverDraft();
  }, [resetCoverDraft]);

  return {
    form,
    draft,
    hasChanges,
    removeCover,
    replacementCover,
    applyReplacementCover,
    handleChangeField,
    toggleRemoveCover,
    resetForSong,
    resetAfterWrittenSave,
    resetAfterNoopSave,
  };
};
