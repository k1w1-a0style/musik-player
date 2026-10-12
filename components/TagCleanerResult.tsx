import React from 'react';
import { Text, View } from 'react-native';
import type { CleanerJournal, CleanerRow } from '../types/TagCleaner';
import { useAppTheme } from '../contexts/AppThemeContext';
import { TagCleanerButton } from './TagCleanerButton';
const statusLabels={planned:'geplant',pending:'offen',displayed:'Anzeige gespeichert',written:'Datei geändert',skipped:'übersprungen',failed:'fehlgeschlagen',interrupted:'unterbrochen'};
export const TagCleanerResult=({rows,journal,onExport,onChoose}:{rows:CleanerRow[];journal?:CleanerJournal;onExport:()=>void;onChoose:()=>void})=>{
  const {theme}=useAppTheme();
  const entries=journal?.entries??[];
  const changed=entries.filter(e=>e.status==='written'||e.status==='displayed').length;
  const skipped=entries.filter(e=>e.status==='skipped').length;
  const failed=entries.filter(e=>e.status==='failed').length;
  const pending=entries.filter(e=>e.status==='pending'||e.status==='interrupted').length;
  return <View style={{gap:12}}><Text testID="tag-cleaner-result" style={{color:theme.palette.text.primary,fontSize:20}}>D · Ergebnis</Text>
    <Text style={{color:theme.palette.text.primary}}>{rows.length} geprüft · {rows.filter(r=>r.status==='clean').length} unverändert · {changed} geändert · {skipped} übersprungen · {rows.filter(r=>r.status==='conflict').length} Konflikte · {failed} fehlgeschlagen · {pending} offen / unterbrochen</Text>
    {entries.map((entry,index)=><Text key={index} style={{color:theme.palette.text.secondary}}>{entry.songId}: {statusLabels[entry.status]}{entry.error?` · ${entry.error}`:''}</Text>)}
    <Text style={{color:theme.palette.text.secondary}}>Kein Rückgängig verfügbar: Native Originalbackups dienen der Transaktions-Recovery und werden nach bestätigtem Abschluss bereinigt. Offene Operationen zuerst durch native Recovery klären; es gibt keine automatische Wiederholung.</Text>
    <TagCleanerButton label="Ergebnisbericht exportieren" onPress={onExport}/><TagCleanerButton label="Neue Auswahl" onPress={onChoose}/>
  </View>;
};
