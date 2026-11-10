import {Ionicons} from '@expo/vector-icons';
import {useState} from 'react';
import {Alert,Pressable,Text,TextInput,View} from 'react-native';
import {requireOptionalNativeModule} from 'expo-modules-core';
import {supabase} from '@/lib/supabase';
import {reportDiagram} from '@/lib/reportDiagram.mjs';
import {useTheme} from '@/theme/ThemeProvider';
type Row=Record<string,any>;
export function productionDate(r:Row){
 const explicit=r.fecha||r.fecha_avance;
 if(explicit)return String(explicit).slice(0,10);
 const t=new Date(r.created_at);
 return Number.isFinite(t.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(t):'';
}
export function ShareDailyProgress({date,entries,workId,workName}:{date:string,entries:{part:Row,history:Row[]}[],workId:number,workName:string}){
 const {colors}=useTheme(),[open,setOpen]=useState(false),[activities,setActivities]=useState(''),[busy,setBusy]=useState(false);
 const groups=entries.map(e=>({...e,day:e.history.filter(r=>productionDate(r)===date)})).filter(e=>e.day.length);
 const original=[...new Set(groups.flatMap(g=>g.day.map(r=>String(r.observaciones||r.observacion||r.comentario||'').trim())).filter(Boolean))].join('\n');
 const [notes,setNotes]=useState(original);
 const fmt=(n:number)=>n.toLocaleString('es-CL',{maximumFractionDigits:3}),label=date.split('-').reverse().join('-');
 const body=groups.map(({part,history,day})=>{
  const total=Number(part.cantidad??part.cantidad_presupuestada),unit=part.unidad||'unidades',sum=(rows:Row[])=>rows.reduce((n,r)=>n+Number(r.cantidad||0),0);
  const done=sum(history.filter(r=>productionDate(r)&&productionDate(r)<=date)),now=sum(day),pct=(v:number)=>total>0?fmt(100*v/total)+' %':'Sin base presupuestada';
  return '*'+part.partida+'*\n- Avance del día: '+pct(now)+'\n- Avance acumulado: '+pct(done)+'\n- Total unidades ejecutadas día: '+fmt(now)+' '+unit+'\n- Pendiente de instalación: '+(Number.isFinite(total)?fmt(Math.max(0,total-done))+' '+unit:'Sin presupuesto')+'\n- Total partida: '+(Number.isFinite(total)?fmt(total)+' '+unit:'Sin presupuesto');
 }).join('\n\n');
 const message='Buenos días, comparto reporte de avance del día *'+label+'* correspondiente a la obra *'+workName+'*\n\nActividades del día:\n'+activities.trim()+'\n\n*Registro de avance*\nPartidas ejecutadas:\n'+body+'\n\nObservaciones\n'+(notes.trim()||'Sin observaciones.')+'\n\nQue tengas un buen día,';
 async function share(){if(busy||!activities.trim())return;setBusy(true);try{
 const {data,error}=await supabase.rpc('specialty_api',{p_work:workId,p_action:'state',p_data:{}});if(error)throw error;
 const diagrams=groups.flatMap(g=>{const points=reportDiagram(data.elements,data.sessions,g.part.id,date);return points.length?[{title:workName+' · '+label+' · '+g.part.partida,points}]:[];});
 const native=requireOptionalNativeModule('ObraxisUpdater');if(typeof native?.shareProgress!=='function')throw Error('La función requiere actualizar la APK.');
 await native.shareProgress(message,JSON.stringify(diagrams));
 }catch(e:any){Alert.alert('No se pudo compartir',e.message);}finally{setBusy(false);}}
 const style={color:colors.ink,borderColor:colors.line,borderWidth:1,borderRadius:8,padding:8};
 return <View style={{gap:8}}><Pressable accessibilityRole="button" accessibilityState={{expanded:open}} style={({pressed})=>({backgroundColor:pressed?'#064e3b':'#08704c',padding:12,borderRadius:12,flexDirection:'row',alignItems:'center',gap:8})} onPress={()=>setOpen(!open)}><Ionicons name="logo-whatsapp" size={22} color="white"/><Text style={{color:'white',fontWeight:'700'}}>{open?'Cerrar preparación':'Preparar reporte para WhatsApp'}</Text></Pressable>{open&&<><Text style={{color:colors.ink}}>Actividades del día (obligatorio)</Text><TextInput multiline style={style} value={activities} onChangeText={setActivities}/><Text style={{color:colors.ink}}>Observaciones para compartir</Text><TextInput multiline style={style} value={notes} onChangeText={setNotes}/><Text style={{color:colors.ink}}>{message}</Text><Pressable disabled={busy||!activities.trim()} onPress={share}><Text style={{color:busy||!activities.trim()?colors.muted:colors.blue}}>{busy?'Preparando…':'Compartir texto y diagrama'}</Text></Pressable></>}</View>;
}
