import { useState } from 'react';
import { useWaveformPreparation } from '../utils/libraryWaveformPreparation';
import { useLibraryScanOperation, type LibraryScanOperation } from '../utils/libraryScanOperation';
import { useMetadataRefreshOperation } from '../utils/metadataRefreshOperation';
import type { LibraryImportStatusProps } from '../components/LibraryImportStatus';

const hasScanWarnings = (scan: LibraryScanOperation): boolean => {
  const progress = scan.progress;
  return [scan.errorMessage, scan.folderPersistenceWarning, ['partial', 'failed', 'cancelled'].includes(scan.status),
    (scan.remainingCount ?? 0) > 0, (progress?.statistics?.unverifiedCount ?? 0) > 0,
    (progress?.statistics?.errorCount ?? 0) > 0,
    progress && progress.processed < progress.total].some(Boolean);
};

export const useLibraryProcessingStatus = (visible: boolean, props: LibraryImportStatusProps) => {
  const preparation = useWaveformPreparation();
  const scan = useLibraryScanOperation();
  const refresh = useMetadataRefreshOperation();
  const [details, setDetails] = useState(false);
  const showWaveforms = preparation.status !== 'idle' && (preparation.status !== 'completed' || preparation.failed > 0);
  const running = [props.scanning, scan.status === 'running', preparation.status === 'running',
    ['running', 'cancelling'].includes(refresh.status)].some(Boolean);
  const needsAttention = [props.persistenceWarning, hasScanWarnings(scan), preparation.failed > 0,
    ['cancelled', 'failed'].includes(preparation.status),
    ['failed', 'partial', 'resumable', 'cancelled'].includes(refresh.status)].some(Boolean);
  const show = [visible, showWaveforms, needsAttention, running, scan.status === 'completed'].some(Boolean);
  // Keep the tiny last-result control stable; Android may deliver a tap after
  // a slow provider transition. No timer may remove its target or receipt.
  const label = needsAttention ? 'Aktualisierung prüfen' : running ? 'Bibliothek wird aktualisiert' : 'Bibliothek aktualisiert';
  return { preparation, details, setDetails, showWaveforms, running, needsAttention, show, label };
};
