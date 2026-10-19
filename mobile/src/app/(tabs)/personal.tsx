import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Card, Empty, ErrorBox, Header, Loading, Screen, SearchField } from '@/components/ui';
import { useSupabaseList } from '@/hooks/useSupabaseList';
import { supabase } from '@/lib/supabase';

type Worker={id:number;nombre:string;rut?:string;cargo?:string;obra_nombre?:string;tipo_contrato?:string;fecha_vencimiento_contrato?:string};

export default function People(){
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);
const{profile}=useAuth();const[q,setQ]=useState('');const state=useSupabaseList<Worker>(async()=>{const{data,error}=await supabase.from('maestro_personal').select('id,nombre,rut,cargo,obra_nombre,tipo_contrato,fecha_vencimiento_contrato').eq('empresa',profile!.empresa).order('nombre');if(error)throw error;return data||[]},profile?.empresa);const list=useMemo(()=>state.data.filter(item=>`${item.nombre} ${item.rut} ${item.cargo} ${item.obra_nombre}`.toLowerCase().includes(q.toLowerCase())),[q,state.data]);const assigned=state.data.filter(item=>item.obra_nombre&&!String(item.obra_nombre).toLowerCase().includes('sin asign')).length;return <Screen refreshing={state.loading} onRefresh={state.refresh}><Header title="Recursos Humanos" subtitle="Personal, asignaciones y documentación." icon="people-outline"/><View style={s.summary}><Metric value={state.data.length} label="Personal total"/><Metric value={assigned} label="Asignados"/><Metric value={state.data.length-assigned} label="Sin asignar"/></View><SearchField value={q} onChangeText={setQ} placeholder="Buscar persona, RUT, cargo u obra"/><ErrorBox text={state.error}/>{state.loading&&!state.data.length?<Loading/>:!list.length?<Empty text="No encontramos personas con ese criterio."/>:list.map(item=><Card key={item.id} onPress={()=>router.push({pathname:'/trabajador/[id]',params:{id:String(item.id)}})}><View style={s.row}><View style={s.avatar}><Text style={s.initial}>{item.nombre?.[0]||'P'}</Text></View><View style={s.flex}><Text style={s.name}>{item.nombre}</Text><Text style={s.meta}>{item.rut} · {item.cargo||'Sin cargo'}</Text><Text style={s.assignment}>{item.obra_nombre||'Sin asignación vigente'}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted}/></View></Card>)}</Screen>}
function Metric({value,label}:{value:number;label:string}){
  const s=useThemedStyles(createStyles);
return <View><Text style={s.value}>{value}</Text><Text style={s.caption}>{label}</Text></View>}
const createStyles = (colors: ThemeColors) => StyleSheet.create({summary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:18,flexDirection:'row',justifyContent:'space-around'},value:{fontSize:23,fontWeight:'700',color:colors.blue,textAlign:'center'},caption:{fontSize:11,color:colors.muted,marginTop:5},search:{height:50,borderWidth:1,borderColor:colors.line,borderRadius:14,backgroundColor:colors.surface,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9},input:{flex:1,fontSize:13,color:colors.ink},row:{flexDirection:'row',alignItems:'center',gap:11},avatar:{width:42,height:42,borderRadius:14,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},initial:{fontSize:18,fontWeight:'700',color:colors.blue},flex:{flex:1},name:{fontSize:14,fontWeight:'700',color:colors.ink},meta:{fontSize:11,color:colors.muted,marginTop:2},assignment:{fontSize:12,color:colors.green,fontWeight:'700',marginTop:4}});
