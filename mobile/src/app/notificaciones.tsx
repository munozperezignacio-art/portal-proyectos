import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Screen } from '@/components/ui';
import { fetchNotificationInbox, markNotificationRead, MobileNotification, openNotification } from '@/lib/notifications';
import { colors } from '@/lib/theme';

const routeFor = (code:string) => code.startsWith('maquinaria_') || code.startsWith('mantenimiento_') ? '/maquinaria' : code.startsWith('rrhh_') ? '/personal' : code.startsWith('prevencion_') ? '/formularios' : '/obras';
export default function NotificationsScreen(){
  const { profile } = useAuth(); const [items,setItems]=useState<MobileNotification[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load=useCallback(async()=>{if(!profile)return;setLoading(true);setError('');try{setItems(await fetchNotificationInbox(profile.id))}catch(e){setError(e instanceof Error?e.message:'No fue posible cargar las notificaciones.')}finally{setLoading(false)}},[profile]);
  useEffect(()=>{if(!profile)return;let active=true;fetchNotificationInbox(profile.id).then(rows=>{if(active)setItems(rows)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'No fue posible cargar las notificaciones.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[profile]);
  const open=async(item:MobileNotification)=>{if(profile&&!item.leida_at){await markNotificationRead(profile.id,item.id).catch(()=>undefined);setItems(old=>old.map(row=>row.id===item.id?{...row,leida_at:new Date().toISOString()}:row))}openNotification({route:routeFor(item.evento_codigo),obra:item.obra_nombre})};
  return <Screen refreshing={loading} onRefresh={load}><Pressable onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={20}/><Text style={s.backText}>Volver</Text></Pressable><Header title="Notificaciones" subtitle="Alertas asignadas a tu usuario, rol y obras." icon="notifications-outline"/><ErrorBox text={error}/>{loading?<Loading/>:items.length?items.map(item=><Card key={item.id} onPress={()=>void open(item)}><View style={s.row}><View style={[s.icon,!item.leida_at&&s.iconNew]}><Ionicons name={item.leida_at?'notifications-outline':'notifications'} size={20} color={item.leida_at?colors.muted:colors.orange}/></View><View style={s.flex}><View style={s.titleRow}><Text style={s.title}>{item.asunto||'Nueva notificación'}</Text>{!item.leida_at&&<Badge tone="amber">Nueva</Badge>}</View><Text style={s.meta}>{item.obra_nombre||'Nivel empresa'} · {new Date(item.created_at).toLocaleString('es-CL')}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted}/></View></Card>):<Empty text="No tienes notificaciones asignadas."/>}</Screen>
}
const s=StyleSheet.create({back:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:12},backText:{fontSize:12,fontWeight:'800',color:colors.ink},row:{flexDirection:'row',alignItems:'center',gap:12},icon:{width:42,height:42,borderRadius:13,backgroundColor:'#F1F4F8',alignItems:'center',justifyContent:'center'},iconNew:{backgroundColor:'#FFF4E8'},flex:{flex:1},titleRow:{flexDirection:'row',alignItems:'center',gap:8},title:{flex:1,fontSize:14,fontWeight:'900',color:colors.ink},meta:{fontSize:10,color:colors.muted,marginTop:5}});
