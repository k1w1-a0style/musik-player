import React, { useState } from 'react';
import { Music } from 'lucide-react-native';
import LibraryMenuItem from './LibraryMenuItem';
import type { LibraryScanRequest, LibraryScanSource } from '../utils/libraryScanSources';

const sources: Array<{ source: LibraryScanSource; label: string; description: string }> = [
  { source: 'media-library', label: 'Android-Musikbibliothek', description: 'Alle von Android erfassten Musiktitel.' },
  { source: 'folders', label: 'Nur Scan-Ordner', description: 'Ausschließlich deine aktiven Ordnerfreigaben.' },
  { source: 'both', label: 'Beide Quellen', description: 'Android-Musikbibliothek und aktive Scan-Ordner.' },
];
const LibraryScanSourceActions = ({ disabled, activeFolders, onImport, onDeepScan }: {
  disabled: boolean; activeFolders: number; onImport: (options?: LibraryScanRequest) => void;
  onDeepScan?: (options?: LibraryScanRequest) => void;
}) => {
  const [mode, setMode] = useState<'quick' | 'full' | null>(null);
  if (mode) return <>
    {sources.map(item => <LibraryMenuItem key={item.source} icon={Music} label={item.label}
      description={item.description} disabled={disabled || (item.source !== 'media-library' && !activeFolders)}
      onPress={() => { (mode === 'full' ? onDeepScan : onImport)?.({ source: item.source }); setMode(null); }} />)}
    <LibraryMenuItem icon={Music} label="Zurück zur Scanauswahl" onPress={() => setMode(null)} />
  </>;
  return <>
    <LibraryMenuItem icon={Music} label="Schnellscan / Import" description="Quelle wählen, neue oder geänderte Dateien einlesen."
      onPress={() => setMode('quick')} disabled={disabled} />
    {onDeepScan ? <LibraryMenuItem icon={Music} label="Vollständiger Scan" description="Quelle wählen, Dateien und Inhalt erneut prüfen."
      onPress={() => setMode('full')} disabled={disabled} /> : null}
  </>;
};
export default LibraryScanSourceActions;
