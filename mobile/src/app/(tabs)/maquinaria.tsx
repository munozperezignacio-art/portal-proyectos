import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MachineryActions } from '@/components/MachineryActions';
import { EquipmentManagementActions } from '@/components/EquipmentManagementActions';
import { SimpleBars, type BarDatum } from '@/components/SimpleBars';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Screen, Segments } from '@/components/ui';
import { useSupabaseList } from '@/hooks/useSupabaseList';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { scheduleMaintenanceSummary } from '@/lib/notifications';
import type { Machinery } from '@/lib/types';
type Row=Record<string,any>;
const tabs=[{key:'equipos',label:'Equipos'},{key:'registros',label:'Registros'},{key:'reservas',label:'Reservas'},{key:'estadisticas',label:'Estadísticas'}];

export default function MachineryScreen(){
  const{profile}=useAuth();const[tab,setTab]=useState('equipos');
  const state=useSupabaseList<Row>(async()=>{const[e,u,r,f,m]=await Promise.all([
    supabase.from('inventario_maquinaria').select('*').eq('empresa',profile!.empresa).order('tipo'),
    supabase.from('maquinaria_uso_diario').select('*').eq('empresa',profile!.empresa).order('fecha',{ascending:false}).limit(100),
    supabase.from('maquinaria_reservas').select('*').eq('empresa',profile!.empresa).order('fecha_inicio'),
    supabase.from('maquinaria_fallas').select('*').eq('empresa',profile!.empresa).order('fecha',{ascending:false}),
    supabase.from('maquinaria_mantenciones').select('*').eq('empresa',profile!.empresa).order('fecha',{ascending:false})
  ]);const failure=[e,u,r,f,m].find(x=>x.error);if(failure?.error)throw failure.error;return[{equipment:e.data||[],usage:u.data||[],reservations:r.data||[],failures:f.data||[],maintenance:m.data||[]}];},profile?.empresa);
  const data=useMemo(()=>state.data[0]||{equipment:[],usage:[],reservations:[],failures:[],maintenance:[]},[state.data]);
  const stats=useMemo(()=>({hours:data.usage.reduce((sum:number,item:Row)=>sum+Number(item.horas_trabajadas||0),0),available:data.equipment.filter((item:Machinery)=>!String(item.estado_equipo).toLowerCase().includes('mant')).length,failures:data.failures.length,maintenance:data.maintenance.length}),[data]);
  const upcoming=useMemo(()=>data.equipment.flatMap((item:Row)=>(Array.isArray(item.planes_mantencion)?item.planes_mantencion:[]).map((plan:Row)=>{const current=Number(item.horometro_inicial||0),last=Number(plan.ultima_lectura||0),interval=Number(plan.intervalo||0),remaining=interval-(current-last);return{equipment:item,name:plan.nombre||'Mantención preventiva',unit:plan.unidad||'horas',remaining,next:last+interval}})).sort((a:Row,b:Row)=>a.remaining-b.remaining),[data.equipment]);
  const usageByEquipment=useMemo<BarDatum[]>(()=>(Object.values(data.usage.reduce((map:Record<string,BarDatum>,item:Row)=>{const key=String(item.equipo_id||item.equipo_patente||item.equipo_tipo);if(!map[key])map[key]={label:`${item.equipo_tipo||'Equipo'} · ${item.equipo_patente||'S/P'}`,value:0};map[key].value+=Number(item.horas_trabajadas||0);return map},{})) as BarDatum[]).sort((a,b)=>b.value-a.value).slice(0,8),[data.usage]);
  useEffect(()=>{void scheduleMaintenanceSummary(upcoming.filter((item:Row)=>item.remaining<=10).length)},[upcoming]);
  return <Screen refreshing={state.loading} onRefresh={state.refresh}>
    <Header title="Maquinaria" subtitle="Flota, uso, reservas y confiabilidad." icon="construct-outline"/>
    <Segments value={tab} options={tabs} onChange={setTab}/>
    {tab==='equipos'?<EquipmentManagementActions equipment={data.equipment} profile={profile!} onSaved={state.refresh}/>:null}
    <View style={s.actions}>{tab==='registros'?<><MachineryActions mode="usage" equipment={data.equipment} profile={profile!} onSaved={state.refresh}/><MachineryActions mode="failure" equipment={data.equipment} profile={profile!} onSaved={state.refresh}/></>:null}{tab==='reservas'?<MachineryActions mode="reservation" equipment={data.equipment} profile={profile!} onSaved={state.refresh}/>:null}</View>
    <ErrorBox text={state.error}/>{state.loading&&!state.data.length?<Loading/>:<>
      {tab==='equipos'&&(data.equipment.length?data.equipment.map((item:Machinery)=><Card key={item.id} onPress={()=>router.push({pathname:'/equipo/[id]',params:{id:String(item.id)}})}><View style={s.row}><View style={s.machine}><Ionicons name="construct" size={22} color={colors.orange}/></View><View style={s.flex}><Text style={s.name}>{item.tipo||'Equipo'} · {item.patente||'S/P'}</Text><Text style={s.meta}>{item.marca||'Sin marca'} · {item.obra_nombre||'Bodega / Sin asignar'}</Text></View><Badge tone={String(item.estado_equipo).toLowerCase().includes('mant')?'amber':'green'}>{item.estado_equipo||'Operativo'}</Badge><Ionicons name="chevron-forward" size={18} color={colors.muted}/></View></Card>):<Empty text="No hay equipos registrados."/>)}
      {tab==='registros'&&<>{data.usage.map((item:Row)=><Card key={`u-${item.id}`}><Badge tone="green">Uso</Badge><Text style={s.name}>{item.equipo_tipo} · {item.equipo_patente}</Text><Text style={s.meta}>{item.fecha} · {Number(item.horas_trabajadas||0).toLocaleString('es-CL')} h · {item.operador||'Sin operador'}</Text></Card>)}{data.failures.map((item:Row)=><Card key={`f-${item.id}`}><Badge tone="red">Falla {item.severidad||''}</Badge><Text style={s.name}>{item.equipo_tipo} · {item.equipo_patente}</Text><Text style={s.meta}>{item.fecha} · {item.descripcion}</Text></Card>)}{!data.usage.length&&!data.failures.length?<Empty text="No hay registros de uso ni fallas."/>:null}</>}
      {tab==='reservas'&&(data.reservations.length?data.reservations.map((item:Row)=><Card key={item.id}><View style={s.row}><View style={[s.dot,{backgroundColor:data.equipment.find((equipment:Machinery)=>equipment.id===item.equipo_id)?.color_calendario||colors.blue}]}/><View style={s.flex}><Text style={s.name}>{item.equipo_tipo} · {item.equipo_patente}</Text><Text style={s.meta}>{item.fecha_inicio} → {item.fecha_fin}</Text><Text style={s.meta}>{item.obra_destino} · {item.solicitante}</Text></View><Badge>{item.estado||'Reservado'}</Badge></View></Card>):<Empty text="No existen reservas vigentes."/>)}
      {tab==='estadisticas'&&<><View style={s.grid}><Metric value={data.equipment.length} label="Equipos"/><Metric value={stats.available} label="Disponibles"/><Metric value={stats.hours.toLocaleString('es-CL')} label="Horas registradas"/><Metric value={stats.failures} label="Fallas"/><Metric value={stats.maintenance} label="Mantenciones"/></View><Card><Text style={s.section}>Uso por equipo</Text>{usageByEquipment.length?<SimpleBars data={usageByEquipment}/>:<Text style={s.meta}>Aún no hay horas registradas.</Text>}</Card><Text style={s.section}>Próximas mantenciones</Text>{upcoming.length?upcoming.slice(0,12).map((item:Row,index:number)=><Card key={`${item.equipment.id}-${index}`}><Badge tone={item.remaining<=0?'red':item.remaining<=10?'amber':'green'}>{item.remaining<=0?'Vencida':'Próxima'}</Badge><Text style={s.name}>{item.equipment.tipo} · {item.equipment.patente||'S/P'}</Text><Text style={s.meta}>{item.name} · en {Math.max(0,item.remaining).toLocaleString('es-CL')} {item.unit}</Text></Card>):<Empty text="No hay planes de mantención configurados."/>}</>}
    </>}</Screen>;
}
function Metric({value,label}:{value:string|number;label:string}){return <Card><Text style={s.value}>{value}</Text><Text style={s.meta}>{label}</Text></Card>}
const s=StyleSheet.create({actions:{flexDirection:'row',gap:8,flexWrap:'wrap'},section:{fontSize:12,fontWeight:'900',textTransform:'uppercase',color:colors.ink,marginTop:6},row:{flexDirection:'row',alignItems:'center',gap:10},machine:{width:43,height:43,borderRadius:13,backgroundColor:'#FFF4E8',alignItems:'center',justifyContent:'center'},flex:{flex:1},name:{fontSize:14,fontWeight:'900',color:colors.ink},meta:{fontSize:11,color:colors.muted,lineHeight:16},dot:{width:12,height:12,borderRadius:6},grid:{gap:10},value:{fontSize:29,fontWeight:'900',color:colors.blue}});
