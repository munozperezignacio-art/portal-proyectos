import React,{useState,useEffect} from 'react';
import {Text,Button} from 'react-native';
import {Screen,Card} from '@/components/ui';
import {useAuth} from '@/auth/AuthProvider';
import {supabase} from '@/lib/supabase';
import {useTheme} from '@/theme/ThemeProvider';
type Row={id:string,vehicle:string,portal:string,date:string,document:string,amount:number};
type Center={id:number,name:string,code:string};
export default function Combustibles(){const {profile}=useAuth();return <Pending key={profile?.empresa+':'+profile?.usuario} company={profile?.empresa}/>}
function Pending({company}:{company?:string}){
 const {colors}=useTheme();const [data,setData]=useState<{rows:Row[],centers:Center[]}|null>(null),[msg,setMsg]=useState(''),[edit,setEdit]=useState(''),[center,setCenter]=useState<number|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;if(company)supabase.rpc('enex_my_pending',{p_company:company}).then(({data,error})=>{if(live){if(error)setMsg('No se pudieron cargar tus movimientos.');else setData(data);}});return()=>{live=false}},[company]);
 async function save(){if(!center||busy)return;setBusy(true);try{const {error}=await supabase.rpc('enex_charge_center',{p_company:company,p_id:edit,p_center:center});if(error)throw error;setData(d=>d&&({...d,rows:d.rows.filter(r=>r.id!==edit)}));setEdit('');setMsg('Asignación guardada.')}catch{setMsg('No se confirmó la asignación. Vuelve a abrir Combustibles para revisar.')}finally{setBusy(false)}}
 return <Screen><Text style={{fontSize:22,fontWeight:'700',color:colors.ink}}>Combustibles</Text><Text style={{color:colors.ink}}>{msg||(!data?'Cargando…':data.rows.length?'Mis cargas pendientes':'No tienes cargas pendientes.')}</Text>{data?.rows.map(r=><Card key={r.id}><Text style={{color:colors.ink,fontWeight:'700'}}>{r.vehicle} · {r.portal}</Text><Text style={{color:colors.ink}}>{r.date} · GD {r.document} · ${Number(r.amount).toLocaleString('es-CL')}</Text>{edit===r.id?<>{data.centers.map(c=><Button key={c.id} disabled={busy} title={(center===c.id?'✓ ':'')+c.code+' · '+c.name} onPress={()=>setCenter(c.id)}/>)}<Button disabled={busy||!center} title="Guardar asignación" onPress={save}/><Button disabled={busy} title="Cancelar" onPress={()=>setEdit('')}/></>:<Button disabled={busy} title="Asignar centro" onPress={()=>{setEdit(r.id);setCenter(null)}}/>}</Card>)}</Screen>
}
