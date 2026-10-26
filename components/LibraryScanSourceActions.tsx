import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { Music } from 'lucide-react-native';
import LibraryMenuItem from './LibraryMenuItem';
import type { LibraryScanRequest } from '../utils/libraryScanSources';
const LibraryScanSourceActions = ({ disabled, onImport, onDeepScan }: {
  disabled: boolean; activeFolders: number; onImport: (options?: LibraryScanRequest) => void;
  onDeepScan?: (options?: LibraryScanRequest) => void;
}) => {
  const [advanced, setAdvanced] = useState(false);
  const { theme } = useAppTheme();
  return <>
    <LibraryMenuItem icon={Music} label="Musikbibliothek aktualisieren"
      description="Neue und geänderte Musik aus allen freigegebenen Quellen."
      onPress={() => onImport()} disabled={disabled} />
    {onDeepScan ? <Pressable accessibilityRole="button" accessibilityLabel="Weitere Scanoptionen"
      disabled={disabled} onPress={() => setAdvanced(value => !value)}
      style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 18 }}>
      <Text style={{ color: theme.palette.text.secondary, fontSize: 12 }}>Weitere Scanoptionen</Text>
    </Pressable> : null}
    {advanced && onDeepScan ? <LibraryMenuItem icon={Music} label="Vollständige Prüfung"
      description="Nur bei Problemen: bereits bekannte Dateien und Inhalte erneut überprüfen."
      onPress={() => onDeepScan()} disabled={disabled} /> : null}
  </>;
};
export default LibraryScanSourceActions;
