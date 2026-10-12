import React from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CleanerChange, CleanerRow } from '../types/TagCleaner';
import { useAppTheme } from '../contexts/AppThemeContext';
const fields:Record<CleanerChange['field'],string>={title:'Titel',artist:'Interpret',albumArtist:'Albuminterpret',album:'Album',year:'Jahr',genre:'Genre',trackNumber:'Track',discNumber:'Disc',comment:'Kommentar',filename:'Dateiname',website:'Website-Frame',folder:'Ordner'};
const confidence={safe:'sicher',review:'prüfen',uncertain:'unsicher'};
const statuses={clean:'bereits sauber',proposal:'Vorschlag',readonly:'nicht beschreibbar',conflict:'Konflikt / prüfen',unreadable:'Original nicht bestätigt'};
export const TagCleanerPreviewRow=({row,onChange,disabled}:{row:CleanerRow;onChange:(index:number,patch:Partial<CleanerChange>)=>void;disabled:boolean})=>{
  const {theme}=useAppTheme();
  const toggle=(index:number,change:CleanerChange)=>{
    if(change.previewOnly||disabled)return;
    if(change.selected){onChange(index,{selected:false});return;}
    if(change.confidence==='safe'||change.confirmed){onChange(index,{selected:true});return;}
    Alert.alert('Einzeländerung prüfen',`${fields[change.field]}: „${change.before}“ → „${change.after}“\n${change.reason}`, [{text:'Abbrechen',style:'cancel'},{text:'Diese Änderung bestätigen',onPress:()=>onChange(index,{confirmed:true,selected:true})}]);
  };
  return <View style={[styles.card,{borderColor:theme.palette.primary}]}>
    <Text style={[styles.title,{color:theme.palette.text.primary}]}>{row.song.title} · {row.song.artist}</Text>
    <Text style={{color:theme.palette.text.secondary}}>{row.song.album??'Ohne Album'} · {statuses[row.status]}</Text>
    {row.changes.map((change,index)=><View key={`${change.field}-${index}`} style={styles.change}>
      <Pressable testID={`tag-cleaner-change-${row.song.id}-${change.field}`} accessibilityRole="checkbox" accessibilityState={{checked:change.selected,disabled:disabled||change.previewOnly}} disabled={disabled||change.previewOnly} onPress={()=>toggle(index,change)}>
        <Text style={{color:change.confidence==='safe'?theme.palette.primary:theme.palette.text.primary}}>{change.previewOnly?'↗':change.selected?'☑':'☐'} {fields[change.field]} · {confidence[change.confidence]}{change.previewOnly?' · nur Export':''}</Text>
      </Pressable>
      <Text testID={`tag-cleaner-before-${row.song.id}-${change.field}`} selectable style={{color:theme.palette.text.secondary}}>Vorher: {change.before||'(fehlt)'}</Text>
      <TextInput testID={`tag-cleaner-after-${row.song.id}-${change.field}`} accessibilityLabel={`${fields[change.field]} Vorschlag für ${row.song.title}`} value={change.after} editable={!disabled}
        onChangeText={after=>onChange(index,{after,confidence:'uncertain',confirmed:false,selected:false})}
        style={[styles.input,{color:theme.palette.text.primary,borderColor:theme.palette.text.secondary}]}/>
      <Text style={{color:theme.palette.text.secondary}}>{change.reason}</Text>
    </View>)}
    {row.notes.map((note,index)=><Text key={index} style={{color:theme.palette.text.secondary}}>{note}</Text>)}
  </View>;
};
const styles=StyleSheet.create({card:{padding:12,borderWidth:1,borderRadius:12,marginVertical:6,gap:6},title:{fontSize:16,fontWeight:'600'},change:{gap:5,paddingVertical:6},input:{borderWidth:1,borderRadius:6,padding:10,minHeight:44}});
