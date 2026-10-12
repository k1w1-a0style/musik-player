import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Playlist, Song } from '../types/Song';
import type { ScanFolder } from '../types/ScanFolder';
import { useAppTheme } from '../contexts/AppThemeContext';
import { getCleanerUnresolvedSongIds, resolveCleanerFolderSelection, uniqueCleanerSongs } from '../utils/tagCleanerSelection';
import { TagCleanerButton } from './TagCleanerButton';
type Kind='songs'|'albums'|'playlists'|'folders';
interface Choice { id:string; label:string; songIds:string[] }
const albumChoices=(songs:readonly Song[]):Choice[]=>{
  const albums=new Map<string,Choice>();
  for(const song of songs){
    const label=`${song.album ?? 'Ohne Album'} · ${song.albumArtist ?? song.artist}`;
    const id=JSON.stringify([song.album??'',song.albumArtist??song.artist]);
    const entry=albums.get(id)??{id,label,songIds:[]};entry.songIds.push(song.id);albums.set(id,entry);
  }
  return [...albums.values()];
};
const choicesFor=(kind:Kind,songs:readonly Song[],playlists:readonly Playlist[],folders:readonly ScanFolder[],recursive:boolean):Choice[]=>{
  if(kind==='albums')return albumChoices(songs);
  if(kind==='playlists')return playlists.map(p=>({id:p.id,label:p.name,songIds:p.songIds}));
  if(kind==='folders')return folders.map(folder=>({id:folder.id,label:folder.name,songIds:resolveCleanerFolderSelection(songs,[folder],recursive).songIds}));
  return uniqueCleanerSongs(songs).map(song=>({id:song.id,label:`${song.title} · ${song.artist}`,songIds:[song.id]}));
};
export const TagCleanerChooser=({songs,playlists,folders,onSelect}:{songs:Song[];playlists:Playlist[];folders:ScanFolder[];onSelect:(ids:string[])=>void})=>{
  const {theme}=useAppTheme();
  const [kind,setKind]=useState<Kind>('songs');
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [recursive,setRecursive]=useState(true);
  const choices=useMemo(()=>choicesFor(kind,songs,playlists,folders,recursive),[kind,songs,playlists,folders,recursive]);
  const ids=useMemo(()=>uniqueCleanerSongs(songs,choices.filter(choice=>selected.has(choice.id)).flatMap(choice=>choice.songIds)).map(song=>song.id),[songs,choices,selected]);
  const unresolved=kind==='folders' ? resolveCleanerFolderSelection(songs,folders.filter(f=>selected.has(f.id)),recursive).unresolvedFolderIds.length : 0;
  const unknownSources=kind==='folders' ? getCleanerUnresolvedSongIds(songs).length : 0;
  const toggle=(id:string)=>setSelected(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const chooseKind=(next:Kind)=>{setKind(next);setSelected(new Set());};
  return <View style={styles.fill}>
    <Text style={[styles.heading,{color:theme.palette.text.primary}]}>Welche Musik möchtest du aufräumen?</Text>
    <TagCleanerButton label={`Gesamte Bibliothek (${uniqueCleanerSongs(songs).length})`} onPress={()=>onSelect(uniqueCleanerSongs(songs).map(s=>s.id))} disabled={!songs.length}/>
    <View style={styles.tabs}>{(['songs','albums','playlists','folders'] as Kind[]).map((tab,index)=><TagCleanerButton key={tab} label={['Titel','Alben','Playlisten','Ordner'][index]} onPress={()=>chooseKind(tab)}/>)}</View>
    {kind==='folders'&&<><View style={styles.tabs}><Text style={{color:theme.palette.text.primary}}>Unterordner einschließen</Text><Switch value={recursive} onValueChange={setRecursive}/></View>
      <Text style={{color:theme.palette.text.secondary}}>Nur nachgewiesene Ordnerzugehörigkeit. {unknownSources} Quellen nicht auflösbar; {unresolved} gewählte Ordner nicht auflösbar. Ohne SAF-Schreibrecht bleiben Vorschau und Export möglich.</Text></>}
    <View style={styles.tabs}><TagCleanerButton label="Alle auf dieser Liste" onPress={()=>setSelected(new Set(choices.map(c=>c.id)))}/><TagCleanerButton label="Auswahl aufheben" onPress={()=>setSelected(new Set())}/></View>
    <FlatList data={choices} keyExtractor={choice=>choice.id} extraData={selected} renderItem={({item})=><Pressable accessibilityRole="checkbox" accessibilityState={{checked:selected.has(item.id)}} onPress={()=>toggle(item.id)} style={styles.choice}>
      <Text style={{color:theme.palette.text.primary}}>{selected.has(item.id)?'☑':'☐'} {item.label}</Text><Text style={{color:theme.palette.text.secondary}}>{uniqueCleanerSongs(songs,item.songIds).length} Titel</Text>
    </Pressable>}/>
    <TagCleanerButton label={`${ids.length} eindeutige Titel · Weiter`} onPress={()=>onSelect(ids)} disabled={!ids.length}/>
  </View>;
};
const styles=StyleSheet.create({fill:{flex:1,gap:8},heading:{fontSize:20,fontWeight:'600'},tabs:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center'},choice:{paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#888'}});
