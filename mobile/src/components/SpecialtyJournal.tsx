import {useCallback,useEffect,useMemo,useState} from 'react';
import {Alert,AppState,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {randomUUID} from 'expo-crypto';
import {supabase} from '@/lib/supabase';
import {createJournalStore} from '@/lib/specialtyJournal.mjs';
import {useTheme} from '@/theme/ThemeProvider';
import {SpecialtyTopographyJournal} from './SpecialtyTopographyJournal';
import {configuredPileParts} from '@/lib/topographyJournal.mjs';
import type {Profile} from '@/lib/types';
import {matchesPile,sortPiles} from '@/lib/pileSearch.mjs';
type Row=Record<string,any>;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function SpecialtyJournal({profile,workId,parts,onSaved,initialOpen=false,quantityAction,onOpenChange}:{profile:Profile;workId:number;parts:Row[];onSaved:()=>void;initialOpen?:boolean;quantityAction?:import('react').ReactNode;onOpenChange?:(open:boolean)=>void}){
 const {colors}=useTheme();
 const [open,setOpen]=useState(initialOpen),[state,setState]=useState<Row>({settings:[],elements:[],sessions:[],protocols:[]}),[selectedPartId,setPartId]=useState(0),[draft,setDraft]=useState<Row|null>(null),[message,setMessage]=useState(''),[search,setSearch]=useState(''),[tab,setTab]=useState('journal');
 const partId=selectedPartId||state.settings[0]?.partida_id||0;
 const cache=`obraxis:specialty:catalog:${profile.empresa}:${profile.auth_user_id||profile.id}:${workId}`;
 const call=useCallback(async(action:string,data:Row={})=>{const result=await supabase.rpc('specialty_api',{p_work:workId,p_action:action,p_data:data});if(result.error)throw result.error;return result.data;},[workId]);
 const load=useCallback(async()=>{try{const network=await NetInfo.fetch();if(network.isConnected===false||network.isInternetReachable===false){const saved=await AsyncStorage.getItem(cache);if(!saved)throw new Error('Abre esta especialidad con conexión para descargar su catálogo primero.');setState(JSON.parse(saved));setMessage('Sin conexión: catálogo guardado en este teléfono.');return;}const next=await call('state');await AsyncStorage.setItem(cache,JSON.stringify(next));setState(next);}catch(e:any){setMessage(e.message);}},[cache,call]);
 // Load the catalog from the server/cache when the work changes.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{void load();},[load]);
 const journal=useMemo(()=>createJournalStore({storage:AsyncStorage,send:call,uuid:randomUUID,scope:`${profile.empresa}:${profile.auth_user_id||profile.id}:${workId}:${partId}`}),[call,profile.empresa,profile.auth_user_id,profile.id,workId,partId]);
 useEffect(()=>{let alive=true;journal.read().then(s=>{if(alive)setDraft(s.draft||null);});return()=>{alive=false;};},[journal]);
 const sync=useCallback(async()=>{try{const response=await journal.sync();const local=await journal.read();setDraft(local.draft||null);if(response){setMessage(response.cancelled?'Jornada cancelada sin registrar avance':local.draft?'Jornada sincronizada':'Cierre sincronizado. Avance registrado una sola vez.');if(!local.draft){await load();onSaved();}}}catch(e:any){setDraft((await journal.read()).draft||null);setMessage(`Guardado en el teléfono. Pendiente de sincronización: ${e.message}`);}},[journal,load,onSaved]);
 useEffect(()=>{if(!open||tab!=='journal'||state.can_execute!==true)return;const timer=setInterval(sync,8000);const network=NetInfo.addEventListener(s=>{if(s.isConnected)sync();});const app=AppState.addEventListener('change',s=>{if(s==='active')sync();});return()=>{clearInterval(timer);network();app.remove();};},[open,tab,state.can_execute,sync]);
 const edit=async(next:Row)=>{setDraft(next);try{await journal.edit(next);setMessage('Guardado en el teléfono');}catch(e:any){setMessage(`No se pudo guardar localmente: ${e.message}`);}};
 const cfg=state.settings.find((s:Row)=>s.partida_id===partId),elements=state.elements.filter((e:Row)=>e.partida_id===partId),rows:Row[]=draft?.datos?.pilas||[];
 const canExecute=state.can_execute===true,canTopo=state.can_topography===true;
 const configured=configuredPileParts(state.settings,parts).filter((s:Row)=>state.elements.some((e:Row)=>Number(e.partida_id)===Number(s.partida_id)));
 const active=open&&configured.length>0;
 useEffect(()=>{onOpenChange?.(active);},[active,onOpenChange]);
 const box={borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,gap:10} as const;
 const input={borderWidth:1,borderColor:colors.line,borderRadius:9,padding:10,color:colors.ink,backgroundColor:colors.surface} as const;
 const button=(label:string,fn:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={fn} style={{padding:12,borderRadius:10,backgroundColor:disabled?colors.soft:colors.primary}}><Text style={{color:disabled?colors.muted:colors.onPrimary,fontWeight:'700'}}>{label}</Text></Pressable>;
 return <View style={{gap:10}}>{!active&&quantityAction}{!active&&configured.length>0&&<View style={{gap:8}}>{canExecute&&button('Pilas de grava · Ejecución',()=>{setTab('journal');setOpen(true);})}{canTopo&&button('Pilas de grava · Topografía',()=>{setTab('topography');setOpen(true);})}</View>}{active&&<>
  {button('Volver al resumen de avances',()=>{setOpen(false);setSearch('');})}
  {tab==='journal'&&<Text accessibilityRole="header" style={{fontSize:18,fontWeight:'700',color:colors.ink}}>Pilas de grava · Ejecución</Text>}
  {message?<Text accessibilityRole="alert" style={{color:colors.ink}}>{message}</Text>:null}
  {configured.length===1?<Text style={{color:colors.muted}}>{parts.find(p=>p.id===partId)?.partida}</Text>:<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{configured.map((s:Row)=><View key={s.partida_id}>{button(parts.find(p=>p.id===s.partida_id)?.partida||String(s.partida_id),()=>{setPartId(s.partida_id);setSearch('');})}</View>)}</View>}
  {!cfg?<Text style={{color:colors.muted}}>No hay especialidad configurada para esta obra. Configura la partida, el catálogo y los responsables desde la web antes de trabajar sin conexión.</Text>:<>
  {tab==='journal'&&(!canExecute?<Text style={{color:colors.muted}}>Tu rol no tiene permiso para registrar avances en esta obra.</Text>:!draft?button('Iniciar / continuar jornada',()=>{const active=state.sessions.find((s:Row)=>s.partida_id===partId&&s.estado==='abierta');edit(active||{id:randomUUID(),partida_id:partId,fecha:today(),revision:0,datos:{pilas:[],observaciones:''}});}):<>
   <Text style={{color:colors.ink,fontWeight:'700'}}>{draft.fecha} · {rows.filter(r=>r.terminada).length} pilas terminadas</Text>
   <TextInput accessibilityLabel="Buscar pila" style={input} placeholder="Buscar número de pila o frente" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch}/>
   {!draft.closeRequested&&search&&<ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{maxHeight:200}}>{sortPiles(elements).filter((e:Row)=>matchesPile(e,search)&&!e.sesion_id&&!rows.some(r=>r.element_id===e.id)).map((e:Row)=><View key={e.id}>{button(`Agregar pila ${e.numero} · ${e.frente||'Sin frente'}`,()=>{edit({...draft,datos:{...draft.datos,pilas:[...rows,{element_id:e.id,equipo:'',paladas:'',volumen:'',longitud:'',terminada:false}]}});setSearch('');})}</View>)}</ScrollView>}
   {rows.map(r=><View key={r.element_id} style={box}><Text style={{color:colors.ink,fontWeight:'700'}}>Pila {elements.find((e:Row)=>e.id===r.element_id)?.numero}</Text>{[['paladas','Paladas'],['longitud','Longitud ejecutada m'],['longitud_perforacion','Longitud perforación m'],['profundidad','Profundidad m']].map(([k,label])=><View key={k}><Text style={{color:colors.muted}}>{label}</Text><TextInput accessibilityLabel={label} style={input} editable={!draft.closeRequested} keyboardType={k==='equipo'?'default':'decimal-pad'} value={String(r[k]??'')} onChangeText={value=>edit({...draft,datos:{...draft.datos,pilas:rows.map(p=>p.element_id===r.element_id?{...p,[k]:k==='equipo'?value:value.replace(',','.')}:p)}})}/></View>)}<Text style={{color:colors.ink}}>Volumen: {r.paladas!==''&&Number(String(cfg?.datos_fijos?.volumen_cuchara??'').replace(',','.'))>0?(Number(r.paladas)*Number(String(cfg?.datos_fijos?.volumen_cuchara??'').replace(',','.'))).toLocaleString('es-CL',{maximumFractionDigits:6})+' m³':'Pendiente de balde o paladas'}</Text>{button('Quitar pila',()=>Alert.alert('¿Quitar esta pila?','Seguirá disponible en el catálogo.',[{text:'Volver',style:'cancel'},{text:'Quitar',style:'destructive',onPress:()=>edit({...draft,datos:{...draft.datos,pilas:rows.filter(p=>p.element_id!==r.element_id)}})}]),!!draft.closeRequested)}{button(r.terminada?'Terminada ✓':'Marcar terminada',()=>edit({...draft,datos:{...draft.datos,pilas:rows.map(p=>p.element_id===r.element_id?{...p,terminada:!p.terminada}:p)}}),!!draft.closeRequested)}</View>)}
   <TextInput accessibilityLabel="Comentarios generales del reporte" multiline editable={!draft.closeRequested} style={input} value={draft.datos.observaciones||''} placeholder="Comentarios generales del reporte" placeholderTextColor={colors.muted} onChangeText={observaciones=>edit({...draft,datos:{...draft.datos,observaciones}})}/>
   {button('Cancelar jornada',()=>Alert.alert('¿Cancelar la jornada?','Se descartarán las pilas y comentarios sin generar avance.',[{text:'Volver',style:'cancel'},{text:'Cancelar jornada',style:'destructive',onPress:async()=>{await journal.cancel();setDraft((await journal.read()).draft);await sync();await sync();}}]),!!draft.closeRequested)}{button('Sincronizar',sync)}{button(draft.cancelRequested?'Cancelación pendiente':draft.closeRequested?'Cierre pendiente de sincronización':'Cerrar jornada',()=>Alert.alert('Cerrar jornada','Se sumarán únicamente las pilas terminadas. Calidad continuará por separado.',[{text:'Cancelar',style:'cancel'},{text:'Cerrar',onPress:async()=>{await journal.close();setDraft((await journal.read()).draft);await sync();await sync();}}]),!!draft.closeRequested)}
  </>)}
  {tab==='topography'&&<SpecialtyTopographyJournal key={`topography:${partId}`} elements={elements} disabled={!canTopo} call={call} scope={`${cache}:topography-journal:${partId}`} onSaved={load}/>}
  </>}
 </>}</View>;
}
