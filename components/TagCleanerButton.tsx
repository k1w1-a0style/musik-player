import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../contexts/AppThemeContext';
export const TagCleanerButton = ({label,onPress,disabled=false,testID}: {label:string;onPress:()=>void;disabled?:boolean;testID?:string}) => {
  const {theme}=useAppTheme();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{disabled}} onPress={onPress} disabled={disabled}
    style={[styles.button,{borderColor:theme.palette.primary,opacity:disabled?0.4:1}]}>
    <Text style={{color:theme.palette.text.primary}}>{label}</Text>
  </Pressable>;
};
const styles=StyleSheet.create({button:{padding:12,borderWidth:1,borderRadius:10,marginVertical:4}});
