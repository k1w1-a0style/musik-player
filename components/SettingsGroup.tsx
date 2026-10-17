import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
export const SettingsGroup=({id,title,summary,children}:{id:string;title:string;summary:string;children:React.ReactNode})=>{
  const {theme}=useAppTheme();
  const [open,setOpen]=useState(false);
  return <View style={{gap:12,borderWidth:1,borderRadius:14,borderColor:theme.palette.border,padding:12}}>
    <Pressable testID={`settings-group-${id}`} accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={{minHeight:48,justifyContent:'center',gap:5}}>
      <Text style={{fontSize:18,color:theme.palette.text.primary}}>{title} {open?'−':'+'}</Text>
      <Text style={{color:theme.palette.text.secondary}}>{summary}</Text>
    </Pressable>
    {open&&children}
  </View>;
};
