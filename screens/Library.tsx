import React from 'react';
import AppErrorBoundary from '../components/AppErrorBoundary';
import LibraryScreenContent from '../components/LibraryScreenContent';
import LibraryScreenFrame from '../components/LibraryScreenFrame';
import { useLibraryController } from '../hooks/useLibraryController';

const LibraryScreenInner: React.FC = () => {
  const controller = useLibraryController();

  return <LibraryScreenContent {...controller} />;
};

const Library: React.FC = () => (
  <LibraryScreenFrame>
    <AppErrorBoundary
      fallbackMessage="Bereich konnte nicht geladen werden."
      logPrefix="[LibraryScreen] ErrorBoundary caught an error"
      testID="library-error-boundary-fallback"
    >
      <LibraryScreenInner />
    </AppErrorBoundary>
  </LibraryScreenFrame>
);

export default Library;
