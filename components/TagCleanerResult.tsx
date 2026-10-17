import React, { useMemo, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import type { CleanerJournal, CleanerJournalEntry, CleanerProcess, CleanerRow } from '../types/TagCleaner';
import { useAppTheme } from '../contexts/AppThemeContext';
import { TagCleanerButton } from './TagCleanerButton';
const statusLabels={planned:'geplant',pending:'Bestätigung / Recovery offen',displayed:'Anzeige gespeichert',written:'Datei und Anzeige bestätigt',skipped:'ausgelassen',failed:'fehlgeschlagen',interrupted:'unterbrochen'};
export const cleanerResultLabel=(entry:CleanerJournalEntry):string=>{
  if(entry.status==='failed'&&entry.writeResult?.operationStatus==='completed'&&entry.writeResult.status==='written')return 'Datei geändert – Anzeige nicht bestätigt';
  return statusLabels[entry.status];
};
export const TagCleanerResult=({rows,journal,process,onExport,onChoose}:{rows:CleanerRow[];journal?:CleanerJournal;process?:CleanerProcess;onExport:()=>void;onChoose:()=>void})=>{
  const {theme}=useAppTheme();
  const [filter,setFilter]=useState<'all'|'changed'|'failed'|'pending'>('all');
  const [details,setDetails]=useState(false);
  const entries=journal?.entries??[];
  const byId=useMemo(()=>new Map(rows.map(row=>[row.song.id,row.song])),[rows]);
  const filtered=entries.filter(entry=>filter==='all'||(filter==='changed'&&['written','displayed'].includes(entry.status))||(filter==='failed'&&entry.status==='failed')||(filter==='pending'&&['pending','interrupted'].includes(entry.status)));
  const changed=entries.filter(e=>e.status==='written'||e.status==='displayed').length;
  const skipped=entries.filter(e=>e.status==='skipped').length;
  const failed=entries.filter(e=>e.status==='failed').length;
  const pending=entries.filter(e=>e.status==='pending'||e.status==='interrupted').length;
  return <View style={{flex:1,gap:8}}><Text testID="tag-cleaner-result" style={{color:theme.palette.text.primary,fontSize:20}}>D · Ergebnis</Text>
    <FlatList testID="tag-cleaner-result-list" data={filtered} keyExtractor={entry=>entry.songId} initialNumToRender={10} windowSize={5}
      ListHeaderComponent={<View style={{gap:8}}>
        {process?.phase==='cancelled'&&<Text style={{color:theme.palette.text.primary}}>Abgebrochen: {process.completed} von {process.total} bearbeitet · {process.recoveryPending?'Keine neue Datei gestartet · Bestätigung / Recovery offen':'0 neue Dateien in Arbeit'}</Text>}
        <Text style={{color:theme.palette.text.primary}}>{rows.length||entries.length} geprüft · {rows.filter(r=>r.status==='clean').length} unverändert · {changed} geändert · {skipped} ausgelassen · {failed} fehlgeschlagen · {pending} offen / unterbrochen</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{(['all','changed','failed','pending'] as const).map((value,index)=><TagCleanerButton key={value} label={['Alle','Bestätigt','Fehler','Offen'][index]} onPress={()=>setFilter(value)}/>)}</View>
        <TagCleanerButton label={details?'Technische Details verbergen':'Technische Details anzeigen'} onPress={()=>setDetails(!details)}/>
      </View>}
      ListEmptyComponent={<Text style={{color:theme.palette.text.secondary}}>Keine Einträge für diese Auswahl.</Text>}
      renderItem={({item})=>{const song=byId.get(item.songId);return <View style={{paddingVertical:10,gap:4}}>
        <Text style={{color:theme.palette.text.primary}}>{song?.title??item.after.title??item.before.title??'Titel'} · {song?.artist??item.after.artist??item.before.artist??''}</Text>
        <Text style={{color:theme.palette.text.secondary}}>{cleanerResultLabel(item)}</Text>
        {!!item.error&&<Text numberOfLines={details?undefined:2} style={{color:theme.palette.text.secondary}}>{details?item.error:'Einzelheit im Bericht prüfen. Keine automatische Wiederholung.'}</Text>}
        {details&&<Text selectable style={{color:theme.palette.text.secondary}}>{item.sourceKey}</Text>}
      </View>;}}/>
    <Text style={{color:theme.palette.text.secondary}}>Kein Rückgängig für Originaldateien. Offene Dateiänderungen zuerst klären; keine automatische Wiederholung.</Text>
    <TagCleanerButton label="Ergebnisbericht exportieren" onPress={onExport}/><TagCleanerButton label="Neue Auswahl" onPress={onChoose}/>
  </View>;
};
