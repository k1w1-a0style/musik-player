import React, { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View, StyleSheet } from 'react-native';
import type { CleanerChange, CleanerProcess, CleanerRow } from '../types/TagCleaner';
import { useAppTheme } from '../contexts/AppThemeContext';
import { TagCleanerButton } from './TagCleanerButton';
import { TagCleanerPreviewRow } from './TagCleanerPreviewRow';
import { selectedCleanerTags } from '../utils/tagCleanerRules';
import { TagCleanerProcess } from './TagCleanerProcess';
const statusOptions=['all','clean','proposal','readonly','conflict','unreadable'] as const;
const statusLabels=['alle','bereits sauber','Vorschlag','nicht beschreibbar','Konflikt','Original unbestätigt'];
const confidenceLabels=['alle','sicher','prüfen','unsicher'];
const fieldLabels=['alle','Titel','Interpret','Albuminterpret','Album','Track','Disc','Genre','Jahr','Kommentar','Dateiname','Website','Ordner'];
const confidenceOptions=['all','safe','review','uncertain'] as const;
const fieldOptions=['all','title','artist','albumArtist','album','trackNumber','discNumber','genre','year','comment','filename','website','folder'] as const;
export const TagCleanerPreview=({rows,busy,process,notice,onChange,onSafe,onApply,onExport,onRules}:{rows:CleanerRow[];busy:boolean;process?:CleanerProcess;notice?:React.ReactNode;onChange:(id:string,index:number,patch:Partial<CleanerChange>)=>void;onSafe:(ids?:readonly string[])=>void;onApply:()=>void;onExport:()=>void;onRules:()=>void})=>{
  const {theme}=useAppTheme();
  const [status,setStatus]=useState(0),[confidence,setConfidence]=useState(0),[field,setField]=useState(0);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [toolsOpen,setToolsOpen]=useState(false);
  const [album,setAlbum]=useState(''),[folder,setFolder]=useState(''),[changed,setChanged]=useState(false);
  const filtered=useMemo(()=>rows.filter(row=>{
    if(changed&&!row.changes.length)return false;
    if(status>0&&row.status!==statusOptions[status])return false;
    if(confidence>0&&!row.changes.some(c=>c.confidence===confidenceOptions[confidence]))return false;
    if(field>0&&!row.changes.some(c=>c.field===fieldOptions[field]))return false;
    return (row.song.album??'').toLowerCase().includes(album.toLowerCase())&&row.sourceKey.toLowerCase().includes(folder.toLowerCase());
  }),[rows,status,confidence,field,album,folder,changed]);
  const selected=rows.filter(row=>Object.keys(selectedCleanerTags(row)).length>0).length;
  const visibleSelected=filtered.filter(row=>Object.keys(selectedCleanerTags(row)).length>0).length;
  const header=<View style={styles.header}>
    {notice}
    {process&&process.phase!=='idle'&&<TagCleanerProcess process={process}/>}
    <TagCleanerButton testID="tag-cleaner-filters" label={filtersOpen?'Filter schließen':'Filter öffnen'} onPress={()=>setFiltersOpen(!filtersOpen)}/>
    <TagCleanerButton testID="tag-cleaner-tools" label={toolsOpen?'Auswahl & Werkzeuge schließen':'Auswahl & Werkzeuge'} onPress={()=>setToolsOpen(!toolsOpen)}/>
    {toolsOpen&&<View style={styles.header}>    <View style={styles.filters}>
    <TagCleanerButton testID="tag-cleaner-select-safe" label="Sichere sichtbare Änderungen auswählen" onPress={()=>onSafe(filtered.map(row=>row.song.id))} disabled={busy}/>
    <TagCleanerButton testID="tag-cleaner-select-safe-all" label="Sichere Änderungen im gesamten Lauf auswählen" onPress={()=>onSafe()} disabled={busy}/>
    </View>    <View style={styles.filters}><TagCleanerButton label="Bericht / Änderungsplan exportieren" onPress={onExport} disabled={busy}/><TagCleanerButton label="Regeln ändern" onPress={onRules} disabled={busy}/></View></View>}
    {filtersOpen&&<View style={styles.header}>
    <View style={styles.filters}><TagCleanerButton label={`Status: ${statusLabels[status]}`} onPress={()=>setStatus((status+1)%statusOptions.length)}/><TagCleanerButton label={`Vertrauen: ${confidenceLabels[confidence]}`} onPress={()=>setConfidence((confidence+1)%confidenceOptions.length)}/><TagCleanerButton label={`Feld: ${fieldLabels[field]}`} onPress={()=>setField((field+1)%fieldOptions.length)}/><TagCleanerButton label={changed?'Nur Änderungen':'Alle Titel'} onPress={()=>setChanged(!changed)}/></View>
    <TextInput accessibilityLabel="Albumfilter" placeholder="Album filtern" placeholderTextColor={theme.palette.text.secondary} value={album} onChangeText={setAlbum} style={[styles.input,{color:theme.palette.text.primary}]}/>
    <TextInput accessibilityLabel="Ordnerfilter" placeholder="Ordner / Quelle filtern" placeholderTextColor={theme.palette.text.secondary} value={folder} onChangeText={setFolder} style={[styles.input,{color:theme.palette.text.primary}]}/>
    </View>}
  </View>;
  return <View style={{flex:1,gap:6}}>
    <FlatList testID="tag-cleaner-preview-list" data={filtered} keyExtractor={row=>row.song.id} ListHeaderComponent={header} initialNumToRender={5} maxToRenderPerBatch={5} windowSize={5}
      ListEmptyComponent={<Text style={{color:theme.palette.text.secondary}}>Keine Titel für diese Filter.</Text>}
      renderItem={({item})=><TagCleanerPreviewRow row={item} disabled={busy} onChange={(index,patch)=>onChange(item.song.id,index,patch)}/>} />
    <Text accessibilityLiveRegion="polite" style={{color:theme.palette.text.primary}}>Sichtbar: {filtered.length} · Insgesamt ausgewählt: {selected} · Außerhalb Filter: {selected-visibleSelected}</Text>

    <TagCleanerButton testID="tag-cleaner-apply" label={`${selected} Titel · Änderungen bestätigen`} onPress={onApply} disabled={busy||!selected}/>

  </View>;
};
const styles=StyleSheet.create({header:{gap:6},filters:{flexDirection:'row',flexWrap:'wrap',gap:6},input:{minHeight:48,padding:10,borderBottomWidth:1,borderColor:'#888'}});
