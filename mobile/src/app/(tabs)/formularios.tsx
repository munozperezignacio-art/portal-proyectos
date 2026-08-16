import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Progress, Screen, Segments } from '@/components/ui';
import { useSupabaseList } from '@/hooks/useSupabaseList';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { can } from '@/lib/types';

type Row=Record<string,any>;
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const mondayOf=(date=new Date())=>{const d=new Date(date);const day=d.getDay()||7;d.setDate(d.getDate()-day+1);d.setHours(0,0,0,0);return d};
const inCurrentPeriod=(row:Row,date:string)=>{if(!date)return false;if(row.frecuencia==='Diario')return date===localDate();const value=new Date(`${date}T12:00:00`),now=new Date();if(row.frecuencia==='Semanal'){const start=mondayOf(now),end=new Date(start);end.setDate(end.getDate()+7);return value>=start&&value<end}return value.getFullYear()===now.getFullYear()&&value.getMonth()===now.getMonth()};
const dueText=(row:Row)=>row.frecuencia==='Semanal'?`${['','Lunes','Martes','Miércoles','Jueves','Viernes'][Number(row.dia_semana)||4]} · ${String(row.hora_limite||'17:00').slice(0,5)}`:row.frecuencia==='Mensual'?`Día ${row.dia_mes||20} · ${String(row.hora_limite||'17:00').slice(0,5)}`:`Lun–Vie · ${String(row.hora_limite||'17:00').slice(0,5)}`;

export default function Forms(){
  const{profile}=useAuth();
  const canView=can(profile,'formularios.formularios.ver')||can(profile,'prevencion.registros.ver'),canCreate=can(profile,'formularios.formularios.crear')||can(profile,'prevencion.registros.crear');
  const[tab,setTab]=useState('asignados');const[q,setQ]=useState('');
  const state=useSupabaseList<Row>(async()=>{
    const[f,r,a,p]=await Promise.all([
      supabase.from('prevencion_formularios').select('id,titulo,descripcion,categoria,codigo,revision,publico_token,created_at').eq('empresa',profile!.empresa).order('created_at',{ascending:false}),
      supabase.from('prevencion_respuestas').select('id,formulario_id,proyecto_nombre,inspector,created_at,prevencion_formularios!inner(titulo,categoria,empresa)').eq('prevencion_formularios.empresa',profile!.empresa).order('created_at',{ascending:false}).limit(100),
      supabase.from('prevencion_cumplimiento_asignaciones').select('*').eq('empresa',profile!.empresa).eq('usuario_id',Number(profile!.id)).eq('activo',true).order('created_at',{ascending:false}),
      supabase.from('prevencion_procedimientos').select('id,codigo,nombre,area,version,obra_nombre,archivo_nombre,fecha').eq('empresa',profile!.empresa).order('codigo')
    ]);
    if(f.error)throw f.error;if(r.error)throw r.error;if(a.error)throw a.error;if(p.error)throw p.error;
    const assignmentIds=(a.data||[]).map((x:Row)=>x.id);let logs:Row[]=[];
    if(assignmentIds.length){const result=await supabase.from('prevencion_cumplimiento_registros').select('*').in('asignacion_id',assignmentIds).order('fecha_cumplimiento',{ascending:false});if(result.error)throw result.error;logs=result.data||[]}
    return[{forms:f.data||[],answers:r.data||[],assignments:a.data||[],procedures:p.data||[],logs}];
  },`${profile?.empresa}:${profile?.id}`);
  const data=state.data[0]||{forms:[],answers:[],assignments:[],procedures:[],logs:[]};
  const formById=useMemo(()=>new Map(data.forms.map((x:Row)=>[Number(x.id),x])),[data.forms]);
  const assignments=useMemo(()=>data.assignments.map((x:Row)=>({...x,form:formById.get(Number(x.formulario_id)),completed:data.logs.some((log:Row)=>Number(log.asignacion_id)===Number(x.id)&&log.estado==='Cumple'&&inCurrentPeriod(x,log.fecha_cumplimiento)),optional:x.frecuencia==='Diario'&&[0,6].includes(new Date().getDay())})),[data.assignments,data.logs,formById]);
  const mandatory=assignments.filter((x:Row)=>!x.optional),completed=mandatory.filter((x:Row)=>x.completed),pending=mandatory.filter((x:Row)=>!x.completed),percent=mandatory.length?completed.length/mandatory.length*100:0;
  const filtered=useMemo(()=>data.forms.filter((x:Row)=>`${x.titulo} ${x.codigo} ${x.categoria}`.toLowerCase().includes(q.toLowerCase())),[q,data.forms]);
  const openProcedure=async(item:Row)=>{const{data:document,error}=await supabase.from('prevencion_procedimientos').select('archivo_base64').eq('id',item.id).eq('empresa',profile!.empresa).maybeSingle();if(error)return Alert.alert('No fue posible cargarlo',error.message);const source=document?.archivo_base64;if(!source)return Alert.alert('Documento no adjunto','Este procedimiento solo tiene su ficha registrada.');try{await Linking.openURL(source.startsWith('data:')||source.startsWith('http')?source:`data:application/pdf;base64,${source}`)}catch{Alert.alert('No fue posible abrirlo','El archivo debe volver a cargarse desde la plataforma web.')}};
  const openAssignment=(x:Row)=>router.push({pathname:'/formulario/[id]',params:{id:String(x.formulario_id),asignacionId:String(x.id)}});

  if(!canView)return <Screen><Header title="Prevención y formularios" subtitle="Acceso restringido" icon="shield-checkmark-outline"/><Empty text="Tu rol no tiene permiso para consultar formularios."/></Screen>;
  return <Screen refreshing={state.loading} onRefresh={state.refresh}>
    <Header title="Prevención y formularios" subtitle="Cumplimiento, registros y procedimientos en terreno." icon="shield-checkmark-outline"/>
    <Segments value={tab} options={[{key:'asignados',label:'Mis asignados'},{key:'cumplimiento',label:'Cumplimiento'},{key:'procedimientos',label:'Procedimientos'},{key:'biblioteca',label:'Biblioteca'},{key:'registros',label:'Registros'}]} onChange={setTab}/>
    {(tab==='biblioteca'||tab==='registros')&&<View style={s.search}><Ionicons name="search" size={18} color={colors.muted}/><TextInput value={q} onChangeText={setQ} placeholder="Buscar formulario" placeholderTextColor="#98A2B3" style={s.input}/></View>}
    <ErrorBox text={state.error}/>
    {state.loading&&!state.data.length?<Loading/>:tab==='asignados'?(
      !assignments.length?<Empty text="No tienes formularios preventivos asignados."/>:assignments.map((x:Row)=><Card key={x.id} onPress={canCreate&&x.form?.publico_token?()=>openAssignment(x):undefined}><View style={s.top}><Badge tone={x.completed?'green':x.optional?'blue':'amber'}>{x.completed?'Completado':x.optional?'Opcional':'Pendiente'}</Badge><Text style={s.rev}>{x.frecuencia}</Text></View><Text style={s.name}>{x.form?.titulo||x.registro_nombre}</Text><Text style={s.meta}>{x.form?.codigo||'Registro preventivo'} · {dueText(x)}</Text>{canCreate&&x.form?.publico_token?<View style={s.action}><Ionicons name={x.completed?'refresh':'play-circle'} size={17} color={colors.blue}/><Text style={s.actionText}>{x.completed?'Realizar nuevamente':'Realizar ahora'}</Text></View>:<Text style={s.unavailable}>{canCreate?'Formulario no publicado':'Solo lectura'}</Text>}</Card>)
    ):tab==='cumplimiento'?<><Card><View style={s.metricTop}><View><Text style={s.metric}>{mandatory.length?`${percent.toFixed(0)}%`:'—'}</Text><Text style={s.meta}>Cumplimiento del periodo actual</Text></View><Ionicons name="shield-checkmark" size={35} color={percent>=100?colors.green:colors.orange}/></View><Progress value={percent} color={percent>=100?colors.green:colors.orange}/></Card><View style={s.metrics}><View style={s.smallMetric}><Text style={[s.smallNumber,{color:colors.green}]}>{completed.length}</Text><Text style={s.smallLabel}>Completados</Text></View><View style={s.smallMetric}><Text style={[s.smallNumber,{color:colors.red}]}>{pending.length}</Text><Text style={s.smallLabel}>Pendientes</Text></View><View style={s.smallMetric}><Text style={[s.smallNumber,{color:colors.blue}]}>{assignments.filter((x:Row)=>x.optional).length}</Text><Text style={s.smallLabel}>Opcionales</Text></View></View>{pending.map((x:Row)=><Card key={x.id} onPress={()=>openAssignment(x)}><View style={s.row}><Ionicons name="time-outline" size={22} color={colors.orange}/><View style={s.flex}><Text style={s.name}>{x.form?.titulo||x.registro_nombre}</Text><Text style={s.meta}>{dueText(x)}</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted}/></View></Card>)}</>
    :tab==='procedimientos'?(!data.procedures.length?<Empty text="No hay procedimientos publicados para tu empresa."/>:data.procedures.map((x:Row)=><Card key={x.id} onPress={()=>openProcedure(x)}><View style={s.row}><View style={s.docIcon}><Ionicons name="document-text-outline" size={22} color={colors.blue}/></View><View style={s.flex}><Text style={s.name}>{x.codigo} · {x.nombre}</Text><Text style={s.meta}>{x.area||'General'} · {x.version||'Sin versión'} · {x.obra_nombre||'Biblioteca corporativa'}</Text><Text style={x.archivo_nombre?s.available:s.unavailable}>{x.archivo_nombre?'Toca para consultar':'Ficha sin archivo adjunto'}</Text></View></View></Card>))
    :tab==='biblioteca'?(!filtered.length?<Empty text="No hay formularios en la biblioteca."/>:filtered.map((x:Row)=><Card key={x.id} onPress={canCreate?()=>router.push({pathname:'/formulario/[id]',params:{id:String(x.id)}}):undefined}><View style={s.top}><Badge>{x.codigo||x.categoria||'Formulario'}</Badge><Text style={s.rev}>Rev. {x.revision||'0'}</Text></View><Text style={s.name}>{x.titulo}</Text><Text style={s.meta}>{x.descripcion||'Sin descripción'}</Text>{x.publico_token&&canCreate?<Text style={s.available}>● Toca para responder</Text>:<Text style={s.unavailable}>{canCreate?'Sin publicación disponible':'Solo lectura'}</Text>}</Card>))
    :(!data.answers.length?<Empty text="Aún no existen registros respondidos."/>:data.answers.map((x:Row)=><Card key={x.id} onPress={()=>router.push({pathname:'/registro/[id]',params:{id:String(x.id)}})}><Text style={s.name}>{x.prevencion_formularios?.titulo||'Registro'}</Text><Text style={s.meta}>{x.proyecto_nombre||'Nivel empresa'} · {x.inspector||'Sin informante'}</Text><Text style={s.date}>{new Date(x.created_at).toLocaleString('es-CL')}</Text></Card>))}
  </Screen>;
}

const s=StyleSheet.create({search:{height:50,borderWidth:1,borderColor:colors.line,borderRadius:14,backgroundColor:'white',paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9},input:{flex:1,fontSize:13,color:colors.ink},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},rev:{fontSize:10,fontWeight:'800',color:colors.muted},name:{fontSize:14,fontWeight:'900',color:colors.ink},meta:{fontSize:11,color:colors.muted,lineHeight:16},available:{fontSize:10,fontWeight:'800',color:colors.green},unavailable:{fontSize:10,fontWeight:'700',color:colors.muted},date:{fontSize:10,color:colors.blue,fontWeight:'700'},action:{flexDirection:'row',alignItems:'center',gap:6,marginTop:3},actionText:{fontSize:11,fontWeight:'900',color:colors.blue},metricTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},metric:{fontSize:34,fontWeight:'900',color:colors.ink},metrics:{flexDirection:'row',gap:9},smallMetric:{flex:1,backgroundColor:'white',borderWidth:1,borderColor:colors.line,borderRadius:16,padding:13,alignItems:'center'},smallNumber:{fontSize:25,fontWeight:'900'},smallLabel:{fontSize:9,fontWeight:'800',color:colors.muted,textAlign:'center'},row:{flexDirection:'row',alignItems:'center',gap:11},flex:{flex:1},docIcon:{width:43,height:43,borderRadius:13,backgroundColor:'#EEF4FF',alignItems:'center',justifyContent:'center'}});
