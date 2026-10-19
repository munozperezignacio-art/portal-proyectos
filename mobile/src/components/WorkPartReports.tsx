import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, Empty, Progress } from '@/components/ui';
import { partReportHistory } from '@/lib/workStatistics';
import type { ThemeColors } from '@/lib/theme';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';

type Row=Record<string,any>;
const reportDate=(r:Row)=>String(r.fecha||r.fecha_avance||r.created_at||'').slice(0,10);
const displayDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)?`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`:'Sin fecha informada';
const quantity=(value:unknown)=>Number.isFinite(Number(value))?Number(value).toLocaleString('es-CL',{maximumFractionDigits:3}):'—';

export function WorkPartReports({parts,reports,cutoff}:{parts:Row[];reports:Row[];cutoff:string}) {
  const {colors}=useTheme();const s=useThemedStyles(styles);const insets=useSafeAreaInsets();
  const [selected,setSelected]=useState<string|null>(null);
  const entries=useMemo(()=>parts.map((part,index)=>({key:String(part.id??index),part,history:partReportHistory(part,parts,reports)})),[parts,reports]);
  const current=entries.find(entry=>entry.key===selected);
  return <>
    <Text style={s.help}>Toca una partida para ver sus reportes de avance.</Text>
    {entries.map(({key,part,history})=><Card key={key} onPress={()=>setSelected(key)}>
      <View style={s.row}><Text style={[s.name,s.flex]}>{part.partida}</Text><Ionicons name="chevron-forward" size={19} color={colors.muted}/></View>
      <Text style={s.meta}>{quantity(part.done)} de {quantity(part.cantidad??part.cantidad_presupuestada)} {part.unidad}</Text>
      <Progress value={part.pct}/>
      <View style={s.row}><Ionicons name="document-text-outline" size={16} color={colors.blue}/><Text style={s.link}>{history.length} {history.length===1?'reporte':'reportes'} · Ver historial</Text></View>
    </Card>)}
    <Modal visible={!!current} transparent animationType="slide" onRequestClose={()=>setSelected(null)}>
      <View style={s.overlay}><View style={[s.sheet,{paddingBottom:Math.max(16,insets.bottom),marginTop:Math.max(20,insets.top)}]}>
        <View style={s.top}><View style={s.flex}><Text accessibilityRole="header" style={s.title}>Reportes de avance</Text><Text style={s.name}>{current?.part.partida}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar reportes de avance" onPress={()=>setSelected(null)} style={s.close}><Ionicons name="close" size={24} color={colors.ink}/></Pressable></View>
        {current&&<><View style={s.summary}><Text style={s.name}>{quantity(current.part.done)} de {quantity(current.part.cantidad??current.part.cantidad_presupuestada)} {current.part.unidad}</Text><Progress value={current.part.pct}/><Text style={s.meta}>Acumulado al {displayDate(cutoff)} · {current.history.length} {current.history.length===1?'reporte':'reportes'}</Text></View>
          <FlatList data={current.history} keyExtractor={(item,index)=>String(item.id??index)} contentContainerStyle={s.list} initialNumToRender={10} ListEmptyComponent={<Empty text="Esta partida todavía no tiene reportes de avance."/>} renderItem={({item,index})=><View style={s.report}>
            <View style={s.between}><Text style={s.date}>{displayDate(reportDate(item))}</Text>{index===0&&<Badge>Más reciente</Badge>}</View>
            <Text style={s.amount}>{quantity(item.cantidad)} <Text style={s.unit}>{item.unidad||current.part.unidad}</Text></Text>
            <View style={s.row}><Ionicons name="person-outline" size={15} color={colors.muted}/><Text style={[s.meta,s.flex]}>{item.supervisor||item.responsable||'Sin responsable informado'}</Text></View>
            <Text style={s.note}>{String(item.observaciones||item.observacion||item.comentario||'Sin observaciones.').trim()||'Sin observaciones.'}</Text>
            {reportDate(item)>cutoff&&<Badge tone="amber">Fecha posterior al corte · no suma al avance</Badge>}
          </View>}/>
        </>}
      </View></View>
    </Modal>
  </>;
}
const styles=(c:ThemeColors)=>StyleSheet.create({help:{fontSize:12,lineHeight:18,color:c.muted},row:{flexDirection:'row',alignItems:'center',gap:8},flex:{flex:1,minWidth:0},name:{fontSize:14,fontWeight:'600',lineHeight:21,color:c.ink},meta:{fontSize:12,lineHeight:18,color:c.muted},link:{fontSize:12,fontWeight:'600',color:c.blue},overlay:{flex:1,backgroundColor:c.overlay,justifyContent:'flex-end'},sheet:{maxHeight:'92%',backgroundColor:c.surface,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,gap:14,flexShrink:1},top:{flexDirection:'row',alignItems:'flex-start',gap:10},title:{fontSize:21,fontWeight:'700',color:c.ink,marginBottom:7},close:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:c.soft},summary:{backgroundColor:c.soft,borderRadius:13,padding:14,gap:9},list:{gap:12,paddingBottom:8},report:{padding:15,gap:10,borderWidth:1,borderColor:c.line,borderRadius:14},between:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8},date:{fontSize:13,fontWeight:'600',color:c.ink},amount:{fontSize:25,fontWeight:'700',color:c.blue},unit:{fontSize:14,fontWeight:'500',color:c.muted},note:{fontSize:13,lineHeight:20,color:c.ink}});
