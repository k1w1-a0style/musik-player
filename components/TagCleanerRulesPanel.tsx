import React from 'react';
import { Switch, Text, View, StyleSheet } from 'react-native';
import type { CleanerMode, CleanerRules } from '../types/TagCleaner';
import { useAppTheme } from '../contexts/AppThemeContext';
import { TagCleanerButton } from './TagCleanerButton';
const labels:Record<keyof CleanerRules,string>={whitespace:'Leerzeichen und Unicode',assignment:'Fehlende Artist-/Title-Zuordnung prüfen',numbers:'Track-/Discnummern',consistency:'Album-/Artist-Schreibweise prüfen',urlSuffix:'Klar abgegrenzte Website-Anhänge',filenames:'Dateinamen-Vorschläge (nur Export)',privateUrls:'Website-Frames prüfen (nur Export)'};
export const TagCleanerRulesPanel=({count,rules,mode,onRule,onMode,onProfile,onAnalyze,onChoose,busy}:{count:number;rules:CleanerRules;mode:CleanerMode;onRule:(rule:Partial<CleanerRules>)=>void;onMode:(mode:CleanerMode)=>void;onProfile:(thorough:boolean)=>void;onAnalyze:()=>void;onChoose:()=>void;busy:boolean})=>{
  const {theme}=useAppTheme();
  return <View style={styles.panel}>
    <Text style={[styles.heading,{color:theme.palette.text.primary}]}>A · {count} eindeutige Titel</Text>
    <Text style={{color:theme.palette.text.secondary}}>Behutsam ist Standard. Analyse liest nur Originaldateien. Cover, Publisher, ReplayGain und unbekannte Frames bleiben erhalten.</Text>
    <View style={styles.row}><TagCleanerButton label="Behutsam" onPress={()=>onProfile(false)} disabled={busy}/><TagCleanerButton label="Gründlich" onPress={()=>onProfile(true)} disabled={busy}/></View>
    {(Object.keys(labels) as (keyof CleanerRules)[]).map(key=><View key={key} style={styles.row}><Text style={[styles.label,{color:theme.palette.text.primary}]}>{labels[key]}</Text><Switch value={rules[key]} onValueChange={value=>onRule({[key]:value})} disabled={busy}/></View>)}
    <Text style={[styles.heading,{color:theme.palette.text.primary}]}>Ziel: {mode==='display'?'Nur Bibliotheksanzeige':'Originaldatei-Tags'}</Text>
    <Text style={{color:theme.palette.text.secondary}}>{mode==='display'?'Vorschläge verwenden die aktuelle Anzeige. Deine Korrekturen bleiben bei weiteren Läufen stabil. Originaldateien bleiben unverändert.':'Vorschläge verwenden bestätigte rohe Dateitags. Schreiben nur für freigegebene Android-SAF-MP3/M4A/MP4. Andere Quellen: Vorschau und Export.'}</Text>
    <View style={styles.row}><TagCleanerButton testID="tag-cleaner-mode-display" label="Nur Anzeige (Standard)" onPress={()=>onMode('display')} disabled={busy}/><TagCleanerButton testID="tag-cleaner-mode-file" label="Datei-Tags" onPress={()=>onMode('file')} disabled={busy}/></View>
    <Text style={{color:theme.palette.text.secondary}}>Dateinamen, Ordner und Website-Frame-Löschungen sind Vorschläge für den Export. Für Datei-Tags: Titel vorher vollständig aus der Warteschlange entfernen.</Text>
    <TagCleanerButton testID="tag-cleaner-analyze" label="Nur analysieren und Vorschau öffnen" onPress={onAnalyze} disabled={busy||!count}/>
    <TagCleanerButton label="Auswahl ändern" onPress={onChoose} disabled={busy}/>
  </View>;
};
const styles=StyleSheet.create({panel:{gap:12},heading:{fontSize:18,fontWeight:'600'},row:{flexDirection:'row',flexWrap:'wrap',gap:8,alignItems:'center',justifyContent:'space-between'},label:{flex:1}});
