import { useEffect, useState } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { AppStackParamList } from '../types/navigation';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { useTagEditorCapability } from './useTagEditorCapability';
import { useTagEditorCoverFlow } from './useTagEditorCoverFlow';
import { useTagEditorFlowGuards } from './useTagEditorFlowGuards';
import { useTagEditorForm } from './useTagEditorForm';
import { useTagEditorSaveFlow } from './useTagEditorSaveFlow';
import { useTagEditorSong } from './useTagEditorSong';
import { useTagEditorStatus } from './useTagEditorStatus';

export const useTagEditorScreenState = () => {
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const { songs, updateSongMetadata } = useLibraryMusicContext();
  const { song, activeSongId, activeSongRef } = useTagEditorSong(songs);
  const [saving, setSaving] = useState(false);
  const { beginCoverFlow, beginSaveFlow, invalidateFlows, isCoverFlowStale, isSaveFlowStale } =
    useTagEditorFlowGuards(activeSongRef);
  const { status, setStatus, clearStatus } = useTagEditorStatus();
  const {
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
  } = useTagEditorForm(song);

  useEffect(() => {
    const activeSong = activeSongRef.current;
    invalidateFlows();
    setSaving(false);
    if (!activeSong) return;
    resetForSong(activeSong);
    clearStatus();
  }, [activeSongId, activeSongRef, clearStatus, invalidateFlows, resetForSong]);

  const {
    capability,
    hasCover,
    canSave,
    canWriteCover,
    coverCapabilityMessage,
    capabilityMessage,
    blockedReasonMessage,
    safetyMessage,
  } = useTagEditorCapability({ song, draft, hasChanges, saving });

  const handlePickCover = useTagEditorCoverFlow({
    song,
    canWrite: canWriteCover,
    saving,
    beginCoverFlow,
    isCoverFlowStale,
    setStatus,
    applyReplacementCover,
  });

  const onSaveConfirmed = useTagEditorSaveFlow({
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
  });

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
    canWriteCover,
    coverCapabilityMessage,
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
