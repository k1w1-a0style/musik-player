import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { CleanerProcess } from '../types/TagCleaner';
const phaseLabels:Record<CleanerProcess['phase'],string>={idle:'Bereit',reading:'Dateien prüfen',applying:'Änderungen speichern',complete:'Lauf ausgewertet',cancelled:'Abgebrochen',failed:'Nicht abgeschlossen'};
export const TagCleanerProcess = ({process}:{process:CleanerProcess}) => {
  const {theme}=useAppTheme();
  const reduced=useReducedMotion();
  const value=useRef(new Animated.Value(0)).current;
  const fraction=process.total>0 ? Math.min(1,process.completed/process.total) : 0;
  useEffect(()=>{
    value.stopAnimation();
    // Advancing directly to the confirmed value never animates ahead of an ACK.
    if(reduced)value.setValue(fraction);
    else {const animation=Animated.timing(value,{toValue:fraction,duration:180,useNativeDriver:false});animation.start();return()=>animation.stop();}
  },[fraction,reduced,value]);
  const active=process.phase==='reading'||process.phase==='applying';
  return <View style={{gap:6}}>
    <Text accessibilityLiveRegion="polite" style={{color:theme.palette.text.secondary}}>{phaseLabels[process.phase]} · {Math.floor(fraction*10)*10} % {process.recoveryPending?'· Bestätigung offen':''}</Text>
    <Text style={{color:theme.palette.text.primary}}>{phaseLabels[process.phase]}: {process.completed} von {process.total} {process.phase==='reading'?'gelesen':'bearbeitet'}</Text>
    {active&&!reduced&&<ActivityIndicator color={theme.palette.primary}/>}
    <View accessible accessibilityRole="progressbar" accessibilityValue={{min:0,max:process.total,now:process.completed}}
      style={{height:6,backgroundColor:theme.palette.text.secondary,borderRadius:3,overflow:'hidden'}}>
      <Animated.View style={{height:6,backgroundColor:theme.palette.primary,width:value.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
    </View>
    {!!process.currentDisplayLabel&&<Text numberOfLines={1} style={{color:theme.palette.text.secondary}}>{process.currentDisplayLabel}</Text>}
    {process.cancelRequested&&<Text style={{color:theme.palette.text.primary}}>Stoppen nach der laufenden Datei vorgemerkt.</Text>}
    {process.recoveryPending&&<Text accessibilityRole="alert" style={{color:theme.palette.text.primary}}>Dateiänderung oder Wiederherstellung noch nicht vollständig bestätigt. Nicht erneut schreiben.</Text>}
  </View>;
};
