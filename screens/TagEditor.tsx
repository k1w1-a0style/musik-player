import React from 'react';
import AppErrorBoundary from '../components/AppErrorBoundary';
import TagEditorContent from './TagEditorContent';
import TagEditorNotFound from './TagEditorNotFound';
import { useTagEditorScreenState } from './useTagEditorScreenState';

export { buildDraftFromDirtyFields, hasRemovableCover } from './tagEditorHelpers';

const TagEditorScreenInner: React.FC = () => {
  const {
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
    goBack,
  } = useTagEditorScreenState();

  if (!song) return <TagEditorNotFound />;

  return (
    <TagEditorContent
      form={form}
      saving={saving}
      removeCover={removeCover}
      replacementCover={replacementCover}
      currentCoverUri={song.coverInfo?.uri ?? song.cover}
      status={status}
      capability={capability}
      hasCover={hasCover}
      canSave={canSave}
      capabilityMessage={capabilityMessage}
      blockedReasonMessage={blockedReasonMessage}
      safetyMessage={safetyMessage}
      onPickCover={() => {
        void handlePickCover();
      }}
      onChangeField={handleChangeField}
      onToggleRemoveCover={toggleRemoveCover}
      onConfirmSave={() => {
        void onSaveConfirmed();
      }}
      onBack={goBack}
    />
  );
};

const TagEditor: React.FC = () => (
  <AppErrorBoundary
    fallbackMessage="Bereich konnte nicht geladen werden."
    logPrefix="[TagEditor] ErrorBoundary caught an error"
    testID="tag-editor-error-boundary-fallback"
  >
    <TagEditorScreenInner />
  </AppErrorBoundary>
);

export default TagEditor;