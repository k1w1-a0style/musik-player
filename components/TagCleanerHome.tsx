import React from 'react';
import {ScrollView,Text,View} from 'react-native';
import {useAppTheme} from '../contexts/AppThemeContext';
import {TagCleanerButton} from './TagCleanerButton';
export const TagCleanerHome=({count,hasResult,notice,onChoose,onSources,onResult}:{count:number;hasResult:boolean;notice?:React.ReactNode;onChoose:()=>void;onSources:()=>void;onResult:()=>void})=>{
 const {theme}=useAppTheme();
 return <ScrollView contentContainerStyle={{gap:16,paddingBottom:16}} testID="tag-cleaner-home">
   {notice}
   <View style={{gap:8,padding:16,borderWidth:1,borderColor:theme.palette.primary,borderRadius:16}}>
     <Text style={{fontSize:20,color:theme.palette.text.primary}}>Deine Sammlung. Deine Entscheidung.</Text>
     <Text style={{color:theme.palette.text.secondary}}>{count} eindeutige Titel. Musik und Felder auswählen, Vorschläge prüfen und erst dann anwenden.</Text>
   </View>
   <TagCleanerButton testID="tag-cleaner-open-selection" label="Tags korrigieren" onPress={onChoose} disabled={!count}/>
   <TagCleanerButton label="Quellen & Scan in Bibliothek öffnen" onPress={onSources}/>
   <TagCleanerButton testID="tag-cleaner-last-result" label="Letzten Lauf ansehen" onPress={onResult} disabled={!hasResult}/>
   <Text style={{color:theme.palette.text.secondary}}>Standardmäßig wird nur die Anzeige geändert. Originaldateien benötigen eine gesonderte Bestätigung.</Text>
 </ScrollView>;
};
