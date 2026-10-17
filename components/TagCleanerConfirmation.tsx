import React, {useState} from 'react';
import {FlatList,Modal,Pressable,Text,View} from 'react-native';
import type {CleanerMode,CleanerRow} from '../types/TagCleaner';
import {useAppTheme} from '../contexts/AppThemeContext';
import {useReducedMotion} from '../hooks/useReducedMotion';
import {selectedCleanerRows} from '../utils/tagCleanerModel';
import {selectedCleanerTags} from '../utils/tagCleanerRules';
import {TagCleanerButton} from './TagCleanerButton';
import Screen from './Screen';
const labels:Record<string,string>={title:'Titel',artist:'Interpret',albumArtist:'Albuminterpret',album:'Album',year:'Jahr',genre:'Genre',trackNumber:'Track',discNumber:'Disc',comment:'Kommentar'};
export const TagCleanerConfirmation=({rows,mode,onClose,onApply}:{rows:CleanerRow[];mode:CleanerMode;onClose:()=>void;onApply:()=>void})=>{
 const {theme}=useAppTheme();
 const reduced=useReducedMotion();
 const [ack,setAck]=useState(false),[details,setDetails]=useState(false);
 const selected=selectedCleanerRows(rows);
 const changes=selected.reduce((count,row)=>count+Object.keys(selectedCleanerTags(row)).length,0);
 return <Modal animationType={reduced?'none':'fade'} onRequestClose={onClose}>
  <View style={{flex:1,backgroundColor:theme.palette.background}}><Screen contentStyle={{padding:16,gap:10}}>
   <Text accessibilityRole="header" style={{fontSize:22,color:theme.palette.text.primary}}>Änderungen abschließend prüfen</Text>
   <Text style={{color:theme.palette.text.primary}}>{selected.length} Titel · {changes} Feldänderungen · {mode==='file'?'Originaldatei-Tags schreiben':'Nur Bibliotheksanzeige'}</Text>
   <FlatList testID="tag-cleaner-confirm-list" data={selected} keyExtractor={row=>row.song.id} initialNumToRender={5} windowSize={5}
    ListHeaderComponent={<View style={{gap:8}}>
     {mode==='file'?<>
      <Text accessibilityRole="alert" style={{color:theme.palette.text.primary}}>Kein dauerhaftes Rückgängig. Das Bibliotheksbackup sichert keine Musikdateien. Sichere die Originale vorher separat. Recovery schützt nur eine laufende Transaktion. Bei Abbruch stoppt der Lauf nach der aktuellen Datei.</Text>
      <Pressable testID="tag-cleaner-original-backup-ack" accessibilityRole="checkbox" accessibilityState={{checked:ack}} onPress={()=>setAck(!ack)} style={{minHeight:48,paddingVertical:10,justifyContent:'center'}}>
       <Text style={{color:theme.palette.text.primary}}>{ack?'☑':'☐'} Ich habe die Originale gesichert und bestätige diese Dateiänderungen.</Text>
      </Pressable>
     </>:<Text style={{color:theme.palette.text.secondary}}>Die Originaldateien bleiben unverändert.</Text>}
     <TagCleanerButton label={details?'Quellpfade verbergen':'Genaue Quellpfade anzeigen'} onPress={()=>setDetails(!details)}/>
    </View>}
    renderItem={({item})=><View style={{paddingVertical:12,gap:6}}>
     <Text style={{color:theme.palette.text.primary}}>{item.song.title} · {item.song.artist}</Text>
     <Text style={{color:theme.palette.text.secondary}}>Quelle: {item.song.fileInfo?.filename??item.song.title} · {item.song.album??'Ohne Album'}</Text>
     {details&&<Text selectable style={{color:theme.palette.text.secondary}}>{item.sourceKey}</Text>}
     {item.changes.filter(change=>change.selected&&!change.previewOnly&&(change.confidence==='safe'||change.confirmed)).map(change=><Text key={change.field} style={{color:theme.palette.text.primary}}>{labels[change.field]}: {change.before||'(fehlt)'} → {change.after||'(leer)'}</Text>)}
    </View>}/>
   <TagCleanerButton testID="tag-cleaner-confirm-apply" label="Ausgewählte Änderungen anwenden" onPress={onApply} disabled={!selected.length||(mode==='file'&&!ack)}/>
   <TagCleanerButton label="Zurück zur Vorschau" onPress={onClose}/>
  </Screen></View>
 </Modal>;
};
