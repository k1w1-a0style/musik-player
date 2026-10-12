import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import AppBackground from '../components/AppBackground';
import Screen from '../components/Screen';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useLibraryMusicContext } from '../contexts/MusicContext';
import { useTagCleaner } from '../hooks/useTagCleaner';
import { TagCleanerChooser } from '../components/TagCleanerChooser';
import { TagCleanerRulesPanel } from '../components/TagCleanerRulesPanel';
import { TagCleanerPreview } from '../components/TagCleanerPreview';
import { TagCleanerResult } from '../components/TagCleanerResult';
import { TagCleanerButton } from '../components/TagCleanerButton';
import type { ScanFolder } from '../types/ScanFolder';
import { getScanFolders } from '../utils/storage';
import { uniqueCleanerSongs } from '../utils/tagCleanerSelection';
import { selectedCleanerTags } from '../utils/tagCleanerRules';
type CleanerRoute=RouteProp<{TagCleaner:{songIds?:string[]}|undefined},'TagCleaner'>;
const TagCleaner=()=>{
  const route=useRoute<CleanerRoute>();
  const library=useLibraryMusicContext();
  const {theme}=useAppTheme();
  const [folders,setFolders]=useState<ScanFolder[]>([]);
  const [folderError,setFolderError]=useState('');
  const confirmed=library.updateSongMetadataConfirmed;
  const state=useTagCleaner(library.songs,route.params?.songIds,confirmed);
  useEffect(()=>{let active=true;void getScanFolders().then(value=>{if(active)setFolders(value);}).catch(e=>{if(active)setFolderError(`Ordnerauswahl nicht verfügbar: ${String(e)}`);});return()=>{active=false;};},[]);
  const confirmApply=()=>{
    const count=state.rows.filter(row=>Object.keys(selectedCleanerTags(row)).length>0).length;
    const label=state.mode==='display'?'Bibliotheksanzeige speichern':'Originaldatei-Tags schreiben';
    Alert.alert(label,`${count} Titel mit ausgewählten Feldänderungen. ${state.mode==='file'?'Nur bestätigte SAF-Quellen außerhalb der nativen Warteschlange. Native Transaktions-Recovery schützt laufende Writes. Kein dauerhaftes Undo.':'Die Originaldateien bleiben unverändert.'}`, [{text:'Abbrechen',style:'cancel'},{text:'Ausgewählte Änderungen anwenden',onPress:()=>void state.apply()}]);
  };
  return <AppBackground><Screen edges={['bottom']} contentStyle={{flex:1,padding:16,gap:10}}>
    <Text style={{color:theme.palette.text.primary,fontSize:22,fontWeight:'600'}}>Musiksammlung aufräumen</Text>
    {!!state.error&&<Text accessibilityRole="alert" style={{color:theme.palette.text.primary}}>{state.error}</Text>}
    {!!folderError&&<Text style={{color:theme.palette.text.secondary}}>{folderError}</Text>}
    {!!state.journal?.entries.some(e=>e.status==='interrupted'||e.status==='pending')&&<Text style={{color:theme.palette.text.secondary}}>Ein früherer Lauf ist offen oder unterbrochen. Kein automatisches Wiederholen; natives Recovery prüfen und Bericht exportieren.</Text>}
    {state.busy&&<View><ActivityIndicator color={theme.palette.primary}/><Text style={{color:theme.palette.text.primary}}>{state.progress}</Text><TagCleanerButton testID="tag-cleaner-cancel" label="Nach laufender Datei abbrechen" onPress={state.cancel}/></View>}
    {state.stage==='selection'&&<TagCleanerChooser songs={library.songs} playlists={library.playlists} folders={folders} onSelect={state.select}/>}
    {state.stage==='rules'&&<ScrollView><TagCleanerRulesPanel count={uniqueCleanerSongs(library.songs,state.ids??[]).length} rules={state.rules} mode={state.mode} onRule={state.configure} onMode={state.changeMode} onProfile={state.profile} onAnalyze={()=>void state.analyze()} onChoose={state.chooseAgain} busy={state.busy}/></ScrollView>}
    {state.stage==='preview'&&<TagCleanerPreview rows={state.rows} busy={state.busy} onChange={state.changeRow} onSafe={state.selectSafe} onApply={confirmApply} onExport={()=>void state.exportReport()} onRules={()=>state.configure({})}/>}
    {state.stage==='result'&&<ScrollView><TagCleanerResult rows={state.rows} journal={state.journal} onExport={()=>void state.exportReport()} onChoose={state.chooseAgain}/></ScrollView>}
  </Screen></AppBackground>;
};
export default TagCleaner;
