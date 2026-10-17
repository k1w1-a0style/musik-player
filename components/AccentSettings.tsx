import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useAccentPreferences } from '../contexts/AccentPreferencesContext';
import { usePlayerPresentation } from '../contexts/PlayerPresentationContext';
import { ACCENT_IDS, ACCENT_LABELS, applyAppAccent, resolveAccentColor, type AccentId } from '../utils/accentPreferences';
import { getAppTheme, type AppTheme } from '../utils/appTheme';
import { WAVEFORM_ACCENT_LABELS } from '../utils/playerPresentation';
import { getSoundCloudWaveformColors } from '../utils/soundCloudWaveformColors';
type Target='appAccent'|'playerAccent'|'waveform';
const targetLabels:Record<Target,string>={appAccent:'App',playerAccent:'Player',waveform:'Waveform'};
export const accentPreviewColor=(target:Target,id:AccentId,base:AppTheme,cover?:string,player:AccentId='cover'):string=>{
  if(target==='appAccent')return applyAppAccent(base,id,cover).palette.primary;
  if(target==='waveform')return getSoundCloudWaveformColors(resolveAccentColor(player,cover??base.palette.accent),id).played;
  return resolveAccentColor(id,cover??base.palette.primary);
};
const AccentSettings=()=>{
  const {theme,appearance,skin}=useAppTheme();
  const {preferences,setPreferences,isHydrated,coverAccent}=useAccentPreferences();
  const {presentation,setPresentation,isHydrated:waveformHydrated}=usePlayerPresentation();
  const [target,setTarget]=useState<Target>('appAccent');
  const base=getAppTheme(appearance??theme.appearance,skin??theme.skin);
  const selected=target==='waveform'?presentation.waveformAccent:preferences[target];
  const ready=target==='waveform'?waveformHydrated:isHydrated;
  const choose=(id:AccentId)=>{
    if(target==='waveform')setPresentation?.(previous=>({...previous,waveformAccent:id}));
    else setPreferences?.(previous=>({...previous,[target]:id}));
  };
  const preview=(id:AccentId)=>accentPreviewColor(target,id,base,target==='appAccent'?coverAccent:coverAccent??theme.palette.accent,preferences.playerAccent);
  const label=(id:AccentId)=>target==='waveform'?WAVEFORM_ACCENT_LABELS[id]:ACCENT_LABELS[id];
  const color=preview(selected);
  return <View style={styles.section} testID="settings-accents">
    <Text style={[styles.heading,{color:theme.palette.text.primary}]}>Farben</Text>
    <Text style={{color:theme.palette.text.secondary}}>Drei getrennte Einstellungen. Wähle zuerst den Bereich.</Text>
    <View style={styles.choices} accessibilityRole="tablist">{(Object.keys(targetLabels) as Target[]).map(value=><Pressable key={value} testID={`settings-color-target-${value}`} accessibilityRole="tab" accessibilityState={{selected:target===value}} onPress={()=>setTarget(value)} style={[styles.choice,{borderColor:theme.palette.border,backgroundColor:target===value?theme.palette.surfaceElevated:theme.palette.surface}]}><Text style={{color:theme.palette.text.primary}}>{targetLabels[value]}</Text></Pressable>)}</View>
    <View testID="settings-color-preview" style={[styles.preview,{borderColor:color,backgroundColor:theme.palette.surface}]}>
      <Text style={{color:theme.palette.text.primary}}>{targetLabels[target]} · {label(selected)}</Text>
      <View style={styles.sample}><View testID="settings-color-preview-swatch" style={[styles.swatch,{backgroundColor:color}]}/><View style={{height:6,flex:1,backgroundColor:color,borderRadius:3}}/><Text style={{color:theme.palette.text.primary}}>✓</Text></View>
    </View>
    {target==='waveform'&&<Text style={{color:theme.palette.text.secondary}}>Automatisch folgt der Playerfarbe; eine feste Waveform-Farbe bleibt unabhängig.</Text>}
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={`${targetLabels[target]}-Farbe`}>
      {ACCENT_IDS.map(id=><Pressable key={id} testID={target==='waveform'?`settings-waveform-accent-${id}`:`settings-${target}-${id}`} accessibilityRole="radio" accessibilityLabel={`${targetLabels[target]}: ${label(id)}`} accessibilityState={{checked:selected===id,disabled:!ready}} disabled={!ready} onPress={()=>choose(id)} style={[styles.choice,{borderColor:selected===id?theme.palette.primary:theme.palette.border,backgroundColor:theme.palette.surface}]}>
        <View testID={`settings-color-swatch-${id}`} style={[styles.swatch,{backgroundColor:preview(id)}]}/>
        <Text style={{color:theme.palette.text.primary,flexShrink:1}}>{label(id)}{selected===id?' ✓':''}</Text>
      </Pressable>)}
    </View>
    <View style={styles.instant}><Text style={{flex:1,color:theme.palette.text.primary}}>Farben sofort wechseln</Text><Switch testID="settings-instant-colors" accessibilityLabel="Farben sofort wechseln" disabled={!isHydrated} value={preferences.instantColors} onValueChange={instantColors=>setPreferences?.(previous=>({...previous,instantColors}))}/></View>
  </View>;
};
const styles=StyleSheet.create({section:{gap:10},heading:{fontSize:18},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{minHeight:48,minWidth:48,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:8,padding:10,borderWidth:1,borderRadius:12},swatch:{width:18,height:18,borderRadius:9,borderWidth:1,borderColor:'#888'},preview:{padding:12,borderWidth:2,borderRadius:12,gap:8},sample:{flexDirection:'row',alignItems:'center',gap:10},instant:{flexDirection:'row',alignItems:'center',gap:12}});
export default AccentSettings;
