import { useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { DateField } from '@/components/DateField';
import { useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import type { Profile } from '@/lib/types';
type Row = Record<string, any>;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
const initialForm=()=>({fecha:today(),operador:'',horometro_final:'',horas_trabajadas:'',hubo_combustible:'',combustible_cargado:'',hubo_falla:'',detuvo_equipo:'',horas_fuera_servicio:'',descripcion:'',severidad:'Media',observaciones:''});
export function MachineryUsageForm({equipment,initialEquipment,profile,onSaved}:{equipment:Row[];initialEquipment?:Row;profile:Profile;onSaved:()=>void}) {
  const s=useThemedStyles(styles);
  const [open,setOpen]=useState(false),[selected,setSelected]=useState<Row|null>(null),[config,setConfig]=useState<Row>({}),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [form,setForm]=useState<Row>(initialForm),[request,setRequest]=useState(''),[search,setSearch]=useState('');
  const [chargeOptions,setChargeOptions]=useState<string[]>([]);
  const chargeResolver=useRef<((value:string|null)=>void)|null>(null);
  const resolveCharge=(value:string|null)=>{setChargeOptions([]);chargeResolver.current?.(value);chargeResolver.current=null;};
  const set=(key:string,value:string)=>setForm(current=>({...current,[key]:value}));
  const choose=async(item:Row)=>{setLoading(true);setSelected(null);setError('');try{
    const [eq,cfg,doc]=await Promise.all([
      supabase.from('inventario_maquinaria').select('*').eq('id',item.id).eq('empresa',profile.empresa).single(),
      supabase.from('maquinaria_reporte_equipo').select('*').eq('equipo_id',item.id).eq('empresa',profile.empresa).maybeSingle(),
      supabase.from('maquinaria_reporte_config').select('*').eq('empresa',profile.empresa).maybeSingle(),
    ]);
    const failure=[eq,cfg,doc].find(result=>result.error);if(failure?.error)throw failure.error;
    setConfig({...doc.data,unidad:cfg.data?.unidad||'h'});setSelected(eq.data);setRequest(randomUUID());setForm(initialForm());
  }catch(e:any){setError(e.message||'No se pudo cargar el equipo.');}finally{setLoading(false);}};
  const start=()=>{setOpen(true);setError('');setSelected(null);setForm(initialForm());setSearch('');if(initialEquipment)void choose(initialEquipment);};
  const save=async()=>{
    if(busy||!selected)return;
    if(!form.operador.trim()||!form.horometro_final.trim()||!form.hubo_combustible||!form.hubo_falla||form.hubo_falla==='si'&&!form.detuvo_equipo){setError('Completa operador, lecturas y las preguntas de combustible y falla.');return;}
    setBusy(true);setError('');
    const payload={...form,unidad:config.unidad,obra_nombre:selected.obra_nombre||'',horometro_inicial:selected.horometro_inicial??0,hubo_combustible:form.hubo_combustible==='si',hubo_falla:form.hubo_falla==='si',detuvo_equipo:form.detuvo_equipo==='si'};
    try {
      const send=(choice:string|null)=>supabase.rpc('registrar_reporte_maquinaria',{p_equipo_id:selected.id,p_datos:{...payload,obra_cargo_diario:choice},p_solicitud:request});
      let result=await send(null);
      if(result.error?.message==='MAQUINARIA_DESTINO_REQUERIDO') {
        const details=JSON.parse(result.error.details||'{}');const options:string[]=details.obras||[];
        const choice=await new Promise<string|null>(resolve=>{chargeResolver.current=resolve;setChargeOptions(options);});
        if(!choice){setError('Reporte no guardado. Debes elegir el destino del cargo para continuar.');return;}
        result=await send(choice);
      }
      if(result.error)throw result.error;
      setOpen(false);onSaved();Alert.alert('Reporte guardado',`Registro #${result.data.id}. Puedes consultar sus datos en la app; el PDF se descarga desde el portal.`);
    }catch(e:any){setError(e.message||'No se confirmó el envío. Reintenta sin cerrar para evitar duplicados.');}finally{setBusy(false);}
  };
  const field=(key:string,label:string,numeric=false,multiline=false)=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} value={form[key]} onChangeText={value=>set(key,value)} keyboardType={numeric?'decimal-pad':'default'} multiline={multiline} style={[s.input,multiline&&s.multiline]} maxLength={multiline?4000:180}/></View>;
  const choice=(key:string,label:string)=><View style={s.field}><Text style={s.label}>{label}</Text><View style={s.row}>{[['no','No'],['si','Sí']].map(([value,name])=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:form[key]===value}} disabled={busy} onPress={()=>set(key,value)} style={[s.choice,form[key]===value&&s.chosen]}><Text style={s.text}>{name}</Text></Pressable>)}</View></View>;
  return <><Pressable onPress={start} style={s.button}><Text style={s.buttonText}>Registrar reporte</Text></Pressable><Modal visible={open} animationType="slide" onRequestClose={()=>{if(!busy)setOpen(false);}}><KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}><View style={s.top}><Text style={s.title}>Reporte de maquinaria</Text><Pressable disabled={busy} onPress={()=>setOpen(false)} accessibilityLabel="Cerrar reporte"><Text style={s.text}>Cerrar</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
    {chargeOptions.length>0&&<View style={s.box}><Text style={s.title}>Destino del costo diario</Text><Text style={s.help}>El equipo tiene reportes en más de una obra. ¿Dónde considerar la tarifa de este día?</Text>{chargeOptions.map(name=><Pressable key={name} style={s.choice} onPress={()=>resolveCharge(name)}><Text style={s.text}>{name}</Text></Pressable>)}<Pressable onPress={()=>resolveCharge(null)} style={s.choice}><Text style={s.text}>Cancelar envío</Text></Pressable></View>}
    {!initialEquipment&&!selected&&!loading&&<View style={s.box}><Text style={s.label}>Selecciona un equipo</Text><TextInput placeholder="Buscar por código o nombre" value={search} onChangeText={setSearch} style={s.input}/>{equipment.filter(eq=>`${eq.tipo} ${eq.patente}`.toLowerCase().includes(search.toLowerCase())).map(eq=><Pressable key={eq.id} onPress={()=>void choose(eq)} style={s.choice}><Text style={s.text}>{eq.patente} · {eq.tipo}</Text></Pressable>)}</View>}
    {loading?<Text style={s.text}>Cargando datos vigentes…</Text>:selected&&<>
    <View style={s.box}><Text style={s.title}>{selected.patente} · {selected.tipo}</Text><Text style={s.text}>{selected.obra_nombre||'Bodega / Sin asignar'}</Text><Text style={s.help}>Documento {config.codigo||'MAQ-01'} · Rev. {config.revision||'01'}. Datos definidos por gestión de maquinaria.</Text></View>
    <View style={s.box}><Text style={s.title}>1. Jornada y operador</Text><DateField value={form.fecha} onChange={value=>set('fecha',value)} label="Fecha"/>{field('operador','Nombre del operador')}<Text style={s.help}>Registrado por: {profile.nombre||profile.usuario}. Puede ser distinto del operador.</Text></View>
    <View style={s.box}><Text style={s.title}>2. Lecturas ({config.unidad})</Text><Text style={s.text}>Inicial: {selected.horometro_inicial??0} {config.unidad}</Text>{field('horometro_final',`Lectura final (${config.unidad})`,true)}{config.unidad==='km'?field('horas_trabajadas','Horas trabajadas (h)',true):<Text style={s.help}>Las horas se calculan con la diferencia del horómetro.</Text>}</View>
    <View style={s.box}><Text style={s.title}>3. Combustible</Text>{choice('hubo_combustible','¿Hubo carga de combustible?')}{form.hubo_combustible==='si'&&field('combustible_cargado','Litros cargados (L)',true)}</View>
    <View style={s.box}><Text style={s.title}>4. Fallas y paralización</Text>{choice('hubo_falla','¿Hubo falla?')}{form.hubo_falla==='si'&&<>{field('descripcion','Descripción de la falla',false,true)}<Text style={s.label}>Severidad</Text><View style={s.row}>{['Baja','Media','Alta','Crítica'].map(value=><Pressable key={value} disabled={busy} onPress={()=>set('severidad',value)} style={[s.choice,form.severidad===value&&s.chosen]}><Text style={s.text}>{value}</Text></Pressable>)}</View>{choice('detuvo_equipo','¿La falla detuvo el equipo?')}{form.detuvo_equipo==='si'&&field('horas_fuera_servicio','Horas de paralización (h)',true)}</>}</View>
    <View style={s.box}>{field('observaciones','Observaciones (opcional)',false,true)}</View><Pressable disabled={busy} onPress={()=>void save()} style={[s.button,busy&&{opacity:.5}]}><Text style={s.buttonText}>{busy?'Guardando…':'Guardar reporte'}</Text></Pressable>
    </>}
    </ScrollView></KeyboardAvoidingView></Modal></>;
}
const styles=(c:ThemeColors)=>StyleSheet.create({screen:{flex:1,backgroundColor:c.surface,paddingTop:40},top:{padding:18,flexDirection:'row',justifyContent:'space-between',gap:10},content:{padding:16,gap:16,paddingBottom:40},title:{fontSize:16,fontWeight:'700',color:c.ink},text:{fontSize:14,color:c.ink},help:{fontSize:12,color:c.muted,lineHeight:18},error:{color:c.danger,padding:12},box:{borderWidth:1,borderColor:c.line,borderRadius:16,padding:16,gap:14},field:{gap:7},label:{fontSize:13,fontWeight:'600',color:c.ink},input:{borderWidth:1,borderColor:c.line,borderRadius:10,padding:12,fontSize:15,color:c.ink,minHeight:48},multiline:{minHeight:96,textAlignVertical:'top'},row:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{padding:12,minHeight:44,borderRadius:10,borderWidth:1,borderColor:c.line},chosen:{backgroundColor:c.blueSoft,borderColor:c.blue},button:{backgroundColor:c.primary,borderRadius:12,padding:14,alignItems:'center'},buttonText:{color:c.onPrimary,fontWeight:'700'}});
