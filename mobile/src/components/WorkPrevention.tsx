import {useCallback,useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {router} from 'expo-router';
import {supabase} from '@/lib/supabase';
import {can,canAccessWork,type Profile} from '@/lib/types';
import {Card,Empty,ErrorBox,Loading,SearchField} from './ui';
import {useTheme} from '@/theme/ThemeProvider';
type Row=Record<string,any>;
export function WorkPrevention({profile,workName}:{profile:Profile;workName:string}){
 const {colors}=useTheme();const [rows,setRows]=useState<Row[]>([]),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[more,setMore]=useState(false);
 const allowed=can(profile,'obras.prevencion.ver')&&canAccessWork(profile,workName);
 const load=useCallback(async(start=0)=>{setLoading(true);setError('');try{
  if(!allowed)throw new Error('No tienes permiso para consultar Prevención de esta obra.');
  const result=await supabase.from('prevencion_respuestas').select('id,formulario_id,proyecto_nombre,inspector,created_at,prevencion_formularios!inner(titulo,categoria,empresa)').eq('prevencion_formularios.empresa',profile.empresa).eq('proyecto_nombre',workName).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+49);
  if(result.error)throw result.error;setRows(prev=>start?[...prev,...(result.data||[])]:result.data||[]);setMore(result.data?.length===50);
 }catch(e:any){setError(e.message);}finally{setLoading(false);}},[allowed,profile.empresa,workName]);
 // Fetch the selected work when its authorization or identity changes.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{void load();},[load]);
 const shown=rows.filter(r=>`${r.prevencion_formularios?.titulo||''} ${r.prevencion_formularios?.categoria||''} ${r.inspector||''}`.toLowerCase().includes(search.toLowerCase()));
 return <View style={{gap:12}}><Text accessibilityRole="header" style={{color:colors.ink,fontSize:18,fontWeight:'700'}}>Prevención de obra</Text><Text style={{color:colors.muted}}>Formularios respondidos en {workName}.</Text><ErrorBox text={error}/>{allowed&&<><SearchField value={search} onChangeText={setSearch} placeholder="Buscar formulario o informante"/>{shown.map(r=><Card key={r.id} onPress={()=>router.push({pathname:'/registro/[id]',params:{id:String(r.id)}})}><Text style={{color:colors.ink,fontWeight:'700'}}>{r.prevencion_formularios?.titulo||'Formulario'}</Text><Text style={{color:colors.muted}}>{r.inspector||'Sin informante'} · {new Date(r.created_at).toLocaleString('es-CL')}</Text><Text style={{color:colors.blue}}>Ver respuestas →</Text></Card>)}{!loading&&!shown.length&&<Empty text="No hay formularios respondidos que coincidan."/>}{loading?<Loading/>:more&&<Pressable accessibilityRole="button" onPress={()=>void load(rows.length)} style={{padding:14,borderRadius:12,backgroundColor:colors.primary}}><Text style={{color:colors.onPrimary}}>Cargar más registros</Text></Pressable>}</>}</View>;
}
