import React, { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View, StyleSheet } from 'react-native';
import type { CleanerChange, CleanerRow } from '../types/TagCleaner';
import { useAppTheme } from '../contexts/AppThemeContext';
import { TagCleanerButton } from './TagCleanerButton';
import { TagCleanerPreviewRow } from './TagCleanerPreviewRow';
import { selectedCleanerTags } from '../utils/tagCleanerRules';
const statusOptions=['all','clean','proposal','readonly','conflict','unreadable'] as const;
const statusLabels=['alle','bereits sauber','Vorschlag','nicht beschreibbar','Konflikt','Original unbestätigt'];
const confidenceLabels=['alle','sicher','prüfen','unsicher'];
const fieldLabels=['alle','Titel','Interpret','Albuminterpret','Album','Track','Disc','Genre','Jahr','Kommentar','Dateiname','Website','Ordner'];
const confidenceOptions=['all','safe','review','uncertain'] as const;
const fieldOptions=['all','title','artist','albumArtist','album','trackNumber','discNumber','genre','year','comment','filename','website','folder'] as const;
export const TagCleanerPreview=({rows,busy,onChange,onSafe,onApply,onExport,onRules}:{rows:CleanerRow[];busy:boolean;onChange:(id:string,index:number,patch:Partial<CleanerChange>)=>void;onSafe:()=>void;onApply:()=>void;onExport:()=>void;onRules:()=>void})=>{
  const {theme}=useAppTheme();
  const [status,setStatus]=useState(0),[confidence,setConfidence]=useState(0),[field,setField]=useState(0);
  const [album,setAlbum]=useState(''),[folder,setFolder]=useState(''),[changed,setChanged]=useState(false);
  const filtered=useMemo(()=>rows.filter(row=>{
    if(changed&&!row.changes.length)return false;
    if(status>0&&row.status!==statusOptions[status])return false;
    if(confidence>0&&!row.changes.some(c=>c.confidence===confidenceOptions[confidence]))return false;
    if(field>0&&!row.changes.some(c=>c.field===fieldOptions[field]))return false;
    return (row.song.album??'').toLowerCase().includes(album.toLowerCase())&&row.sourceKey.toLowerCase().includes(folder.toLowerCase());
  }),[rows,status,confidence,field,album,folder,changed]);
  const selected=rows.filter(row=>Object.keys(selectedCleanerTags(row)).length>0).length;
  const header=<View style={styles.header}>
    <Text style={{color:theme.palette.text.primary}}>B · Vorschau · {filtered.length}/{rows.length} Titel · {selected} ausgewählt</Text>
    <View style={styles.filters}><TagCleanerButton label={`Status: ${statusLabels[status]}`} onPress={()=>setStatus((status+1)%statusOptions.length)}/><TagCleanerButton label={`Vertrauen: ${confidenceLabels[confidence]}`} onPress={()=>setConfidence((confidence+1)%confidenceOptions.length)}/><TagCleanerButton label={`Feld: ${fieldLabels[field]}`} onPress={()=>setField((field+1)%fieldOptions.length)}/><TagCleanerButton label={changed?'Nur Änderungen':'Alle Titel'} onPress={()=>setChanged(!changed)}/></View>
    <TextInput accessibilityLabel="Albumfilter" placeholder="Album filtern" placeholderTextColor={theme.palette.text.secondary} value={album} onChangeText={setAlbum} style={[styles.input,{color:theme.palette.text.primary}]}/>
    <TextInput accessibilityLabel="Ordnerfilter" placeholder="Ordner / Quelle filtern" placeholderTextColor={theme.palette.text.secondary} value={folder} onChangeText={setFolder} style={[styles.input,{color:theme.palette.text.primary}]}/>
    <TagCleanerButton testID="tag-cleaner-select-safe" label="Nur sichere Feldänderungen auswählen" onPress={onSafe} disabled={busy}/>
    <TagCleanerButton testID="tag-cleaner-apply" label={`${selected} Titel · Änderungen bestätigen`} onPress={onApply} disabled={busy||!selected}/>
    <View style={styles.filters}><TagCleanerButton label="Bericht / Änderungsplan exportieren" onPress={onExport} disabled={busy}/><TagCleanerButton label="Regeln ändern" onPress={onRules} disabled={busy}/></View>
  </View>;
  return <FlatList data={filtered} keyExtractor={row=>row.song.id} ListHeaderComponent={header}
    renderItem={({item})=><TagCleanerPreviewRow row={item} disabled={busy} onChange={(index,patch)=>onChange(item.song.id,index,patch)}/>}/>;
};
const styles=StyleSheet.create({header:{gap:6},filters:{flexDirection:'row',flexWrap:'wrap',gap:6},input:{padding:10,borderBottomWidth:1,borderColor:'#888'}});
