import {Ionicons} from '@expo/vector-icons';
import {useCallback,useState} from 'react';
import {ProgressActivities} from './ProgressActivities';
import {Alert,Pressable,Text,TextInput,View} from 'react-native';
import {requireOptionalNativeModule} from 'expo-modules-core';
import {supabase} from '@/lib/supabase';
import {reportDiagram} from '@/lib/reportDiagram.mjs';
import {useTheme} from '@/theme/ThemeProvider';
import {productionDate,progressShareMessage} from '@/lib/progressShare.mjs';
export {productionDate} from '@/lib/progressShare.mjs';
type Row=Record<string,any>;

export function ShareDailyProgress({date,entries,workId,workName,reportId}:{reportId:number,date:string,entries:{part:Row,history:Row[]}[],workId:number,workName:string}){
 const {colors}=useTheme(),[open,setOpen]=useState(false),[activities,setActivities]=useState(''),[busy,setBusy]=useState(false);
 const [activitiesReady,setActivitiesReady]=useState(false);
 const receiveActivities=useCallback((text:string,ready:boolean)=>{setActivities(text);setActivitiesReady(ready);},[]);
 const groups=entries.map(e=>({...e,day:e.history.filter(r=>productionDate(r)===date)})).filter(e=>e.day.length);
 const original=[...new Set(groups.flatMap(g=>g.day.map(r=>String(r.observaciones||r.observacion||r.comentario||'').trim())).filter(Boolean))].join('\n');
 const [notes,setNotes]=useState(original);
 const label=date.split('-').reverse().join('-');
 const message=progressShareMessage(workName,date,activities,entries,notes);
 async function share(){if(busy||!activitiesReady||!activities.trim())return;setBusy(true);try{
 const {data,error}=await supabase.rpc('specialty_api',{p_work:workId,p_action:'state',p_data:{}});if(error)throw error;
 const diagrams=groups.flatMap(g=>{const points=reportDiagram(data.elements,data.sessions,g.part.id,date);return points.length?[{title:workName+' · '+label+' · '+g.part.partida,points}]:[];});
 const native=requireOptionalNativeModule('ObraxisUpdater');if(typeof native?.shareProgress!=='function')throw Error('La función requiere actualizar la APK.');
 await native.shareProgress(message,JSON.stringify(diagrams));
 }catch(e:any){Alert.alert('No se pudo compartir',e.message);}finally{setBusy(false);}}
 const style={color:colors.ink,borderColor:colors.line,borderWidth:1,borderRadius:8,padding:8};
 return <View style={{gap:8}}><Pressable accessibilityRole="button" accessibilityState={{expanded:open}} style={({pressed})=>({backgroundColor:pressed?'#064e3b':'#08704c',padding:12,borderRadius:12,flexDirection:'row',alignItems:'center',gap:8})} onPress={()=>setOpen(!open)}><Ionicons name="logo-whatsapp" size={22} color="white"/><Text style={{color:'white',fontWeight:'700'}}>{open?'Cerrar preparación':'Preparar reporte para WhatsApp'}</Text></Pressable>{open&&<><ProgressActivities reportId={reportId} onSaved={receiveActivities}/><Text style={{color:colors.ink}}>Observaciones para compartir</Text><TextInput multiline style={style} value={notes} onChangeText={setNotes}/><Text style={{color:colors.ink}}>{message}</Text><Pressable disabled={busy||!activitiesReady} onPress={share}><Text style={{color:busy||!activitiesReady?colors.muted:colors.blue}}>{busy?'Preparando…':'Compartir texto y diagrama'}</Text></Pressable></>}</View>;
}
