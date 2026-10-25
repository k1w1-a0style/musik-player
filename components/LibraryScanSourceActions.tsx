import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
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
  const [mode, setMode] = useState<'quick' | 'full' | 'advanced' | null>(null);
  const { theme } = useAppTheme();
  if (mode === 'advanced') return <>
    {onDeepScan ? <LibraryMenuItem icon={Music} label="Vollständige Prüfung"
      description="Nur bei Problemen: bereits bekannte Dateien und Inhalte erneut überprüfen."
      onPress={() => setMode('full')} disabled={disabled} /> : null}
    <LibraryMenuItem icon={Music} label="Zurück" onPress={() => setMode(null)} />
  </>;
  if (mode) return <>
    {sources.map(item => <LibraryMenuItem key={item.source} icon={Music} label={item.label}
      description={item.description} disabled={disabled || (item.source !== 'media-library' && !activeFolders)}
      onPress={() => { (mode === 'full' ? onDeepScan : onImport)?.({ source: item.source }); setMode(null); }} />)}
    <LibraryMenuItem icon={Music} label="Zurück zur Scanauswahl" onPress={() => setMode(null)} />
  </>;
  return <>
    <LibraryMenuItem icon={Music} label="Musikbibliothek aktualisieren"
      description="Quelle wählen und neue oder geänderte Titel einlesen."
      onPress={() => setMode('quick')} disabled={disabled} />
    {onDeepScan ? <Pressable accessibilityRole="button" accessibilityLabel="Weitere Scanoptionen"
      disabled={disabled} onPress={() => setMode('advanced')}
      style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 18 }}>
      <Text style={{ color: theme.palette.text.secondary, fontSize: 12 }}>Weitere Scanoptionen</Text>
    </Pressable> : null}
  </>;
};
export default LibraryScanSourceActions;
