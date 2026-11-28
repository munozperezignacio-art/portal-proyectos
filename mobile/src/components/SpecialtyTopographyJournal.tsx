import {useEffect,useState,useRef} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {randomUUID} from 'expo-crypto';
import {Card,Empty,SearchField} from '@/components/ui';
import {useTheme} from '@/theme/ThemeProvider';
import {topographyFields,topographyPayload} from '@/lib/topographyJournal.mjs';
import {matchesPile,sortPiles} from '@/lib/pileSearch.mjs';
type Row=Record<string,any>;
function JournalButton({label,onPress,disabled}:{label:string;onPress:()=>void;disabled:boolean}){
 const {colors}=useTheme();return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{backgroundColor:colors.primary,borderRadius:12,padding:14,opacity:disabled?0.5:1}}><Text style={{color:colors.onPrimary,fontWeight:'700'}}>{label}</Text></Pressable>;
}
export function SpecialtyTopographyJournal({elements,scope,disabled,call,onSaved}:{elements:Row[];scope:string;disabled:boolean;call:(action:string,data:Row)=>Promise<any>;onSaved:()=>Promise<void>}){
 const {colors}=useTheme();
 const [date,setDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date()));
 const [rows,setRows]=useState<Row[]>([]),[search,setSearch]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 const lock=useRef(false),writes=useRef(Promise.resolve());
 useEffect(()=>{let alive=true;AsyncStorage.getItem(scope).then(raw=>{if(alive){if(raw){const saved=JSON.parse(raw);setRows(saved.rows||[]);if(saved.date)setDate(saved.date);}setReady(true);}}).catch(()=>{if(alive)setMessage('No fue posible recuperar el borrador. Vuelve a abrir esta obra.');});return()=>{alive=false;};},[scope]);
 const persist=(next:Row[],day=date)=>{setRows(next);writes.current=writes.current.catch(()=>{}).then(()=>AsyncStorage.setItem(scope,JSON.stringify({date:day,rows:next})));writes.current.catch(()=>setMessage('No se pudo guardar el borrador en el teléfono.'));return writes.current;};
 const input={borderWidth:1,borderColor:colors.line,borderRadius:12,padding:12,color:colors.ink,backgroundColor:colors.surface};
 const save=async()=>{if(lock.current||disabled||!rows.length)return;lock.current=true;setBusy(true);let remaining=[...rows];let count=0;
  try{await writes.current;
   // Bind by catalog UUID, never list index or execution order. Keep exact requests for retries.
   for(const row of rows){const element=elements.find(e=>e.id===row.element_id);if(!element)throw new Error('Una pila ya no pertenece al catálogo. Actualiza antes de continuar.');
    const payload=row.request||{...topographyPayload(element,row,date),request_id:randomUUID()};
    remaining=remaining.map(r=>r.element_id===row.element_id?{...r,request:payload}:r);await persist(remaining);
    try{await call('topography',payload);}catch(error:any){if(['P0001','23514','22P02'].includes(error.code)){remaining=remaining.map(r=>r.element_id===row.element_id?{...r,request:undefined}:r);await persist(remaining);}throw error;}
    count++;remaining=remaining.filter(r=>r.element_id!==row.element_id);await persist(remaining);
   }
   setMessage(`${count} pilas guardadas. Topografía vinculada sin sumar avance de ejecución.`);await onSaved();
  }catch(error:any){setMessage(`${count} pilas guardadas; ${remaining.length} pendientes. ${error.message}. El borrador se conserva para reintentar.`);await onSaved();}
  finally{lock.current=false;setBusy(false);}
 };
 const candidates=sortPiles(elements).filter((e:Row)=>!rows.some(r=>r.element_id===e.id)&&matchesPile(e,search));
 const pending=rows.some(r=>r.request);
 return <View style={{gap:12}}><Text accessibilityRole="header" style={{fontSize:18,fontWeight:'700',color:colors.ink}}>Pilas de grava · Topografía</Text>
  <Text style={{color:colors.muted}}>Selecciona las pilas medidas. Pueden registrarse antes o después de su ejecución y en cualquier orden.</Text>
  {disabled?<Empty text="Tu rol necesita Editar en Mediciones de topografía por especialidad."/>:<>
  <Text style={{color:colors.ink}}>Fecha de medición (AAAA-MM-DD)</Text><TextInput accessibilityLabel="Fecha de medición" style={input} editable={!busy&&!pending&&ready} value={date} onChangeText={v=>{setDate(v);void persist(rows,v);}}/>
  <SearchField value={search} onChangeText={setSearch} placeholder="Buscar número de pila o frente"/>
  {search.trim()&&<ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{maxHeight:200}}>{candidates.map((e:Row)=><Card key={e.id}><Text style={{color:colors.ink,fontWeight:'700'}}>Pila {e.numero} · {e.frente||'Sin frente'}</Text><Text style={{color:colors.muted}}>{e.sesion_id?'Ejecución registrada':'Ejecución pendiente'} · {e.topografia?.cota_inicial!=null&&e.topografia?.cota_inicial!==''?'Con mediciones':'Sin mediciones'}</Text><JournalButton label={'Agregar pila '+e.numero} disabled={busy||!ready} onPress={()=>{setSearch('');void persist([{element_id:e.id,baseRevision:e.revision_topografia,baseTopography:e.topografia||{},...Object.fromEntries(topographyFields.map(([k])=>[k,e.topografia?.[k]??'']))},...rows]);}}/></Card>)}{!candidates.length&&<Text style={{color:colors.muted}}>No hay pilas disponibles para esta búsqueda.</Text>}</ScrollView>}
  <Text style={{color:colors.ink,fontWeight:'700'}}>Pilas seleccionadas: {rows.length}</Text>
  {rows.map(row=>{const e=elements.find(p=>p.id===row.element_id);return <Card key={row.element_id}><Text style={{color:colors.ink,fontWeight:'700'}}>Pila {e?.numero} · {e?.frente}</Text>{topographyFields.map(([key,label])=><View key={key}><Text style={{color:colors.muted}}>{label}</Text><TextInput accessibilityLabel={`${label} pila ${e?.numero}`} style={input} keyboardType="numbers-and-punctuation" editable={!busy&&!row.request} value={String(row[key]??'')} onChangeText={v=>void persist(rows.map(r=>r.element_id===row.element_id?{...r,[key]:v}:r))}/></View>)}<JournalButton label={'Quitar pila '+e?.numero} disabled={busy||!ready||!!row.request} onPress={()=>void persist(rows.filter(r=>r.element_id!==row.element_id))}/></Card>;})}
  <JournalButton label={busy?'Guardando…':'Guardar jornada de topografía'} disabled={busy||!ready||!rows.length} onPress={()=>void save()}/>
  </>}{message&&<Text accessibilityRole="alert" style={{color:colors.ink}}>{message}</Text>}</View>;
}
