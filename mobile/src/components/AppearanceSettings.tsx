import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import type { ThemePreference } from '@/lib/themePreference';

const options: {value:ThemePreference;label:string;icon:keyof typeof Ionicons.glyphMap}[] = [
  {value:'light',label:'Claro',icon:'sunny-outline'},
  {value:'dark',label:'Oscuro',icon:'moon-outline'},
  {value:'automatic',label:'Automático',icon:'phone-portrait-outline'},
];
export function AppearanceSettings() {
  const {colors,preference,setPreference}=useTheme();
  const s=useThemedStyles(createStyles);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const select=async(next:ThemePreference)=>{
    if(saving)return;
    setSaving(true);setError('');
    try{await setPreference(next);}catch{setError('No se pudo guardar la apariencia. Inténtalo de nuevo.');}
    finally{setSaving(false);}
  };
  return <View style={s.panel}>
    <Text accessibilityRole="header" style={s.title}>Apariencia</Text>
    <Text style={s.help}>Elige cómo se ve la app.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Apariencia de la app" style={s.options}>
      {options.map(option=><Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{checked:preference===option.value,disabled:saving}} aria-checked={preference===option.value} disabled={saving} onPress={()=>void select(option.value)} style={[s.option,preference===option.value&&s.selected]}>
        <Ionicons name={option.icon} size={21} color={preference===option.value?colors.blue:colors.muted}/>
        <Text style={[s.label,preference===option.value&&s.selectedLabel]}>{option.label}</Text>
      </Pressable>)}
    </View>
    <Text style={s.help}>{preference==='automatic'?'Automático sigue el tema del teléfono.':'Se mantiene este tema aunque cambie el teléfono.'}</Text>
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}
const createStyles=(colors:ThemeColors)=>StyleSheet.create({panel:{gap:10},title:{fontSize:15,fontWeight:'600',color:colors.ink},help:{fontSize:12,lineHeight:18,color:colors.muted},options:{flexDirection:'row',gap:6},option:{flex:1,minHeight:74,borderWidth:1,borderColor:colors.line,borderRadius:12,alignItems:'center',justifyContent:'center',gap:8,paddingVertical:10,paddingHorizontal:3},selected:{backgroundColor:colors.blueSoft,borderColor:colors.blue},label:{fontSize:11,fontWeight:'500',color:colors.muted},selectedLabel:{color:colors.blue,fontWeight:'600'},error:{fontSize:12,color:colors.red,lineHeight:18}});
