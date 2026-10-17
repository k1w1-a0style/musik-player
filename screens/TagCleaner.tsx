import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRoute, useNavigation, usePreventRemove, type RouteProp } from '@react-navigation/native';
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
import type { CleanerRow } from '../types/TagCleaner';
import { TagCleanerConfirmation } from '../components/TagCleanerConfirmation';
import { TagCleanerHome } from '../components/TagCleanerHome';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../types/navigation';
import { TagCleanerProcess } from '../components/TagCleanerProcess';
type CleanerRoute=RouteProp<{TagCleaner:{songIds?:string[]}|undefined},'TagCleaner'>;
const TagCleaner=()=>{
  const route=useRoute<CleanerRoute>();
  const navigation=useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [home,setHome]=useState(!route.params?.songIds);
  const library=useLibraryMusicContext();
  const {theme}=useAppTheme();
  const [folders,setFolders]=useState<ScanFolder[]>([]);
  const [folderError,setFolderError]=useState('');
  const confirmed=library.updateSongMetadataConfirmed;
  const [confirmation,setConfirmation]=useState<CleanerRow[]>();
  const state=useTagCleaner(library.songs,route.params?.songIds,confirmed);
  useEffect(()=>{let active=true;void getScanFolders().then(value=>{if(active)setFolders(value);}).catch(e=>{if(active)setFolderError(`Ordnerauswahl nicht verfügbar: ${String(e)}`);});return()=>{active=false;};},[]);
  usePreventRemove(state.busy,()=>Alert.alert('Lauf noch aktiv','Bitte warte auf den Abschluss oder stoppe nach der laufenden Datei.',[{text:'Weiter warten',style:'cancel'},{text:'Geordnet stoppen',onPress:state.cancel}]));
  const confirmApply=()=>setConfirmation(state.rows.map(row=>({...row,changes:row.changes.map(change=>({...change}))})));
  return <AppBackground><Screen edges={['bottom']} contentStyle={{flex:1,padding:16,gap:10}}>
    <Text style={{color:theme.palette.text.primary,fontSize:22,fontWeight:'600'}}>Musiksammlung aufräumen</Text>
    {!!state.error&&<Text accessibilityRole="alert" style={{color:theme.palette.text.primary}}>{state.error}</Text>}
    {!!folderError&&<Text style={{color:theme.palette.text.secondary}}>{folderError}</Text>}
    {!!state.journal?.entries.some(e=>e.status==='interrupted'||e.status==='pending')&&<Text style={{color:theme.palette.text.secondary}}>Ein früherer Lauf ist offen oder unterbrochen. Kein automatisches Wiederholen; natives Recovery prüfen und Bericht exportieren.</Text>}
    {state.process.phase!=='idle'&&<TagCleanerProcess process={state.process}/>}
    {state.busy&&<View><TagCleanerButton testID="tag-cleaner-cancel" label="Nach laufender Datei abbrechen" onPress={state.cancel}/></View>}
    {state.stage==='selection'&&home&&<TagCleanerHome count={uniqueCleanerSongs(library.songs).length} hasResult={!!state.journal} onChoose={()=>setHome(false)} onSources={()=>navigation.navigate('MainTabs')} onResult={state.showLastResult}/>}
    {state.stage==='selection'&&!home&&<TagCleanerChooser initialIds={state.ids} songs={library.songs} playlists={library.playlists} folders={folders} onSelect={state.select}/>}
    {state.stage==='rules'&&<ScrollView><TagCleanerRulesPanel count={uniqueCleanerSongs(library.songs,state.ids??[]).length} rules={state.rules} fields={state.fields} onFields={state.changeFields} mode={state.mode} onRule={state.configure} onMode={state.changeMode} onProfile={state.profile} onAnalyze={()=>void state.analyze()} onChoose={()=>{state.chooseAgain();setHome(true);}} busy={state.busy}/></ScrollView>}
    {state.stage==='preview'&&<TagCleanerPreview rows={state.rows} busy={state.busy} onChange={state.changeRow} onSafe={state.selectSafe} onApply={confirmApply} onExport={()=>void state.exportReport()} onRules={()=>state.configure({})}/>}
    {state.stage==='result'&&<TagCleanerResult rows={state.rows} journal={state.journal} process={state.process} onExport={()=>void state.exportReport()} onChoose={()=>{state.chooseAgain();setHome(true);}}/>}
    {confirmation&&<TagCleanerConfirmation rows={confirmation} mode={state.mode} onClose={()=>setConfirmation(undefined)} onApply={()=>{setConfirmation(undefined);void state.apply(confirmation);}}/>}
  </Screen></AppBackground>;
};
export default TagCleaner;
