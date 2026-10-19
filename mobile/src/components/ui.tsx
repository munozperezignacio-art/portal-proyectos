import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { shadow } from '@/lib/theme';

export function Screen({ children, refreshing=false, onRefresh }: PropsWithChildren<{refreshing?:boolean;onRefresh?:()=>void}>) {
  const s=useThemedStyles(createStyles);

  return <SafeAreaView style={s.screen} edges={['top']}><ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={onRefresh?<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>:undefined}>{children}</ScrollView></SafeAreaView>;
}
export function Header({ title, subtitle, icon, action }: {title:string;subtitle?:string;icon:keyof typeof Ionicons.glyphMap;action?:ReactNode}) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);

  return <View style={s.header}><View style={s.iconBox}><Ionicons name={icon} size={22} color={colors.blue}/></View><View style={{flex:1,minWidth:0}}><Text accessibilityRole="header" style={s.title}>{title}</Text>{subtitle?<Text style={s.subtitle}>{subtitle}</Text>:null}</View>{action}</View>;
}
export function Card({ children, onPress }: PropsWithChildren<{onPress?:()=>void}>) {
  const s=useThemedStyles(createStyles);
 return onPress?<Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[s.card,pressed&&s.cardPressed]}>{children}</Pressable>:<View style={s.card}>{children}</View>; }
export function Badge({ children, tone='blue' }: PropsWithChildren<{tone?:'blue'|'green'|'amber'|'red'}>) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);
 const map={blue:[colors.blueSoft,colors.blue],green:[colors.greenSoft,colors.green],amber:[colors.amberSoft,colors.amber],red:[colors.redSoft,colors.red]}; return <View style={[s.badge,{backgroundColor:map[tone][0]}]}><Text style={[s.badgeText,{color:map[tone][1]}]}>{children}</Text></View>; }
export function SearchField({value,onChangeText,placeholder='Buscar'}:{value:string;onChangeText:(value:string)=>void;placeholder?:string}) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);
return <View style={s.search}><Ionicons name="search-outline" size={19} color={colors.muted}/><TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} style={s.searchInput}/>{value?<Pressable accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" onPress={()=>onChangeText('')} style={s.clear}><Ionicons name="close-circle" size={18} color={colors.muted}/></Pressable>:null}</View>}
export function Empty({ text }: {text:string}) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);
 return <View style={s.empty}><Ionicons name="file-tray-outline" size={28} color={colors.muted}/><Text style={s.emptyText}>{text}</Text></View>; }
export function Loading() {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);
 return <View style={s.empty}><ActivityIndicator color={colors.orange}/><Text style={s.emptyText}>Cargando información…</Text></View>; }
export function ErrorBox({ text }: {text:string}) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);
 return text?<View style={s.error}><Ionicons name="alert-circle-outline" size={18} color={colors.red}/><Text style={s.errorText}>{text}</Text></View>:null; }
export function Progress({ value, color }: {value:number;color?:string}) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);
 const safe=Math.max(0,Math.min(100,value||0)); return <View><View style={s.track}><View style={[s.fill,{width:`${safe}%`,backgroundColor:color || colors.green}]}/></View><Text style={s.progressText}>{safe.toFixed(1)}%</Text></View>; }
export function Segments({ value, options, onChange }: {value:string;options:{key:string;label:string}[];onChange:(v:string)=>void}) {
  const s=useThemedStyles(createStyles);
 return <ScrollView horizontal style={{flexGrow:0}} showsHorizontalScrollIndicator={false} contentContainerStyle={s.segments}>{options.map(o=><Pressable key={o.key} accessibilityRole="tab" accessibilityState={{selected:value===o.key}} onPress={()=>onChange(o.key)} style={[s.segment,value===o.key&&s.segmentActive]}><Text style={[s.segmentText,value===o.key&&s.segmentTextActive]}>{o.label}</Text></Pressable>)}</ScrollView>; }
const createStyles = (colors: ThemeColors) => StyleSheet.create({screen:{flex:1,backgroundColor:colors.soft},content:{padding:20,paddingTop:18,paddingBottom:32,gap:16,width:'100%',maxWidth:760,alignSelf:'center'},header:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:6},iconBox:{width:44,height:44,borderRadius:13,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},title:{fontSize:23,fontWeight:'700',letterSpacing:-0.6,color:colors.ink},subtitle:{fontSize:13,color:colors.muted,marginTop:4,lineHeight:19},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:18,gap:10,...shadow},cardPressed:{backgroundColor:colors.pressed,borderColor:colors.line},badge:{alignSelf:'flex-start',borderRadius:7,paddingHorizontal:9,paddingVertical:5},badgeText:{fontSize:11,fontWeight:'600'},empty:{alignItems:'center',justifyContent:'center',padding:32,gap:12,borderWidth:1,borderColor:colors.line,borderStyle:'dashed',borderRadius:16,backgroundColor:colors.surface},emptyText:{fontSize:14,lineHeight:21,color:colors.muted,textAlign:'center'},error:{backgroundColor:colors.redSoft,padding:14,borderRadius:12,flexDirection:'row',gap:8},errorText:{color:colors.red,flex:1,fontSize:13,lineHeight:19},track:{height:6,borderRadius:99,backgroundColor:colors.track,overflow:'hidden'},fill:{height:'100%',borderRadius:99},progressText:{fontSize:12,fontWeight:'600',color:colors.ink,textAlign:'right',marginTop:6},segments:{gap:6,paddingVertical:3},segment:{minHeight:44,paddingHorizontal:15,paddingVertical:12,borderRadius:10,justifyContent:'center'},segmentActive:{backgroundColor:colors.selected},segmentText:{fontSize:13,fontWeight:'500',color:colors.muted},segmentTextActive:{color:colors.blue,fontWeight:'600'},search:{minHeight:48,borderWidth:1,borderColor:colors.line,borderRadius:12,backgroundColor:colors.surface,paddingLeft:14,paddingRight:6,flexDirection:'row',alignItems:'center',gap:10},searchInput:{flex:1,minWidth:0,fontSize:14,color:colors.ink,paddingVertical:12},clear:{width:40,height:44,alignItems:'center',justifyContent:'center'}});
