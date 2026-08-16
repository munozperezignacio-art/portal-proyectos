import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Card, ErrorBox, Header, Loading, Screen } from '@/components/ui';
import { invokeResilient } from '@/lib/offlineQueue';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Row=Record<string,any>;
type Field={id:string;type:string;label?:string;required?:boolean;options?:string[];maxRating?:number;subFields?:Field[];buttonText?:string};
const fieldsOf=(campos:any):Field[]=>Array.isArray(campos)?campos:Array.isArray(campos?.items)?campos.items:[];
const emptyInstance=(field:Field)=>Object.fromEntries((field.subFields||[]).map(sub=>[sub.id,sub.type==='checkbox'?[]:'']));

export default function FormFill(){
  const{id,asignacionId}=useLocalSearchParams<{id:string;asignacionId?:string}>();
  const{profile}=useAuth();
  const[form,setForm]=useState<Row|null>(null);
  const[centers,setCenters]=useState<Row[]>([]);
  const[answers,setAnswers]=useState<Record<string,any>>({});
  const[center,setCenter]=useState<Row|null>(null);
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState('');

  useEffect(()=>{(async()=>{try{
    const{data,error:loadError}=await supabase.from('prevencion_formularios').select('*').eq('id',Number(id)).eq('empresa',profile!.empresa).maybeSingle();
    if(loadError)throw loadError;if(!data)throw new Error('El formulario no existe o no está disponible.');
    setForm(data);
    if(data.publico_token){const{data:list,error:centerError}=await supabase.rpc('formulario_centros_gestion',{p_token:data.publico_token});if(!centerError)setCenters(Array.isArray(list)?list:[])}
  }catch(x){setError(x instanceof Error?x.message:'No fue posible cargar el formulario.')}finally{setLoading(false)}})()},[id,profile]);

  const fields=useMemo(()=>fieldsOf(form?.campos),[form]);
  const update=(fieldId:string,value:any)=>setAnswers(current=>({...current,[fieldId]:value}));
  const missing=fields.filter(field=>field.required&&isEmpty(answers[field.id]));
  const submit=async()=>{
    if(!form?.publico_token)return Alert.alert('Formulario no publicado','La empresa debe publicar este formulario antes de responderlo.');
    if(missing.length)return Alert.alert('Faltan respuestas',`Completa: ${missing.map(field=>field.label).join(', ')}`);
    setSaving(true);setError('');
    const signature=fields.find(field=>field.type==='signature');
    const result=await invokeResilient('formulario-publico',{action:'enviar',token:String(form.publico_token),centro_gestion_id:center?.id||null,obra_id:center?.obra_id||null,proyecto_nombre:center?.obra_nombre||'Nivel empresa',inspector:profile?.nombre||profile?.usuario||'Usuario Obraxis',respuestas:answers,firma_url:signature?answers[signature.id]||null:null});
    setSaving(false);
    if(result.error){setError(result.error.message);return}
    if(result.queued){Alert.alert('Formulario pendiente','Quedó guardado en el dispositivo y se enviará automáticamente al recuperar conexión.',[{text:'Aceptar',onPress:()=>router.back()}]);return}
    if(asignacionId){
      const now=new Date();
      const fechaLocal=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const{data:existing}=await supabase.from('prevencion_cumplimiento_registros').select('id').eq('asignacion_id',Number(asignacionId)).eq('fecha_cumplimiento',fechaLocal).maybeSingle();
      const payload={asignacion_id:Number(asignacionId),fecha_cumplimiento:fechaLocal,estado:'Cumple',observaciones:'Formulario completado desde Obraxis Terreno.',verificado_por:profile?.correo||profile?.usuario||'Usuario Obraxis',empresa:profile?.empresa};
      const saved=existing?.id?await supabase.from('prevencion_cumplimiento_registros').update(payload).eq('id',existing.id):await supabase.from('prevencion_cumplimiento_registros').insert(payload);
      if(saved.error){setError(`El formulario fue enviado, pero no se pudo actualizar el cumplimiento: ${saved.error.message}`);return}
    }
    Alert.alert('Formulario enviado','El registro quedó sincronizado con Obraxis.',[{text:'Aceptar',onPress:()=>router.back()}]);
  };

  if(loading)return <Screen><Loading/></Screen>;
  return <Screen>
    <Pressable onPress={()=>router.back()} style={s.back}><Ionicons name="arrow-back" size={20} color={colors.ink}/><Text style={s.backText}>Volver a formularios</Text></Pressable>
    <Header title={form?.titulo||'Formulario'} subtitle={form?.descripcion||'Registro operacional'} icon="clipboard-outline" action={<Badge>{form?.codigo||`Rev. ${form?.revision||0}`}</Badge>}/>
    <ErrorBox text={error}/>
    {centers.length?<Card><Text style={s.section}>Centro de gestión / obra</Text><View style={s.choices}>{centers.map(item=><Choice key={item.id} active={center?.id===item.id} label={`${item.codigo||''} ${item.obra_nombre||item.nombre}`.trim()} onPress={()=>setCenter(item)}/>)}</View></Card>:null}
    {fields.map((field,index)=><Card key={field.id}><Text style={s.label}>{index+1}. {field.label||'Campo'}{field.required?<Text style={s.required}> *</Text>:null}</Text><FieldInput field={field} value={answers[field.id]} onChange={value=>update(field.id,value)}/></Card>)}
    {!fields.length?<Card><Text style={s.help}>Este formulario todavía no tiene campos configurados.</Text></Card>:null}
    <Pressable disabled={saving||!fields.length} onPress={submit} style={[s.submit,(saving||!fields.length)&&s.disabled]}><Ionicons name="send" size={18} color="white"/><Text style={s.submitText}>{saving?'Enviando…':'Enviar formulario'}</Text></Pressable>
  </Screen>;
}

function FieldInput({field,value,onChange}:{field:Field;value:any;onChange:(value:any)=>void}){
  if(field.type==='textarea')return <TextInput multiline value={value||''} onChangeText={onChange} placeholder="Escribe aquí…" style={[s.input,s.textarea]}/>;
  if(['date','time','text','number'].includes(field.type))return <TextInput value={value||''} onChangeText={onChange} keyboardType={field.type==='number'?'decimal-pad':'default'} placeholder={field.type==='date'?'DD-MM-AAAA':field.type==='time'?'HH:MM':'Escribe aquí…'} style={s.input}/>;
  if(['select','radio'].includes(field.type))return <View style={s.choices}>{(field.options||[]).map(option=><Choice key={option} active={value===option} label={option} onPress={()=>onChange(option)}/>)}</View>;
  if(field.type==='checkbox')return <View style={s.choices}>{(field.options?.length?field.options:['Sí']).map(option=>{const list=Array.isArray(value)?value:[];return <Choice key={option} active={list.includes(option)} label={option} square onPress={()=>onChange(list.includes(option)?list.filter(item=>item!==option):[...list,option])}/>})}</View>;
  if(field.type==='rating')return <View style={s.rating}>{Array.from({length:Number(field.maxRating)||5},(_,i)=>i+1).map(score=><Pressable key={score} onPress={()=>onChange(score)}><Ionicons name={Number(value)>=score?'star':'star-outline'} size={31} color={colors.orange}/></Pressable>)}</View>;
  if(field.type==='photo')return <PhotoInput value={value} onChange={onChange}/>;
  if(field.type==='signature')return <View style={s.signature}><SignatureCanvas onOK={onChange} onEmpty={()=>onChange('')} descriptionText="Firma en el recuadro" clearText="Limpiar" confirmText="Usar firma" webStyle={signatureCss}/>{value?<Text style={s.saved}>Firma capturada</Text>:null}</View>;
  if(field.type==='repeater'){
    const rows=Array.isArray(value)?value:[];
    const updateRow=(rowIndex:number,subId:string,next:any)=>onChange(rows.map((row,index)=>index===rowIndex?{...row,[subId]:next}:row));
    return <View style={s.group}>{rows.map((row,rowIndex)=><View key={rowIndex} style={s.groupRow}>{rowIndex>0?<View style={s.separator}/>:null}{(field.subFields||[]).map(sub=><View key={sub.id} style={s.subField}><Text style={s.subLabel}>{sub.label}</Text><FieldInput field={sub} value={row[sub.id]} onChange={next=>updateRow(rowIndex,sub.id,next)}/></View>)}<Pressable onPress={()=>onChange(rows.filter((_,index)=>index!==rowIndex))}><Text style={s.remove}>Quitar registro</Text></Pressable></View>)}<Pressable style={s.add} onPress={()=>onChange([...rows,emptyInstance(field)])}><Ionicons name="add" size={18} color={colors.blue}/><Text style={s.addText}>{String(field.buttonText||'Agregar registro').replace(/^\+\s*/,'')}</Text></Pressable></View>;
  }
  return <TextInput value={value||''} onChangeText={onChange} placeholder="Escribe aquí…" style={s.input}/>;
}

function Choice({active,label,onPress,square=false}:{active:boolean;label:string;onPress:()=>void;square?:boolean}){return <Pressable onPress={onPress} style={s.choice}><Ionicons name={active?(square?'checkbox':'radio-button-on'):(square?'square-outline':'radio-button-off')} size={22} color={active?colors.blue:colors.muted}/><Text style={s.choiceText}>{label}</Text></Pressable>}
function PhotoInput({value,onChange}:{value?:string;onChange:(value:string)=>void}){const pick=async()=>{const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)return Alert.alert('Permiso necesario','Autoriza acceso a fotografías para adjuntar evidencia.');const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],base64:true,quality:.55});if(!result.canceled&&result.assets[0]?.base64)onChange(`data:${result.assets[0].mimeType||'image/jpeg'};base64,${result.assets[0].base64}`)};return <View>{value?<Image source={{uri:value}} style={s.photo}/>:null}<Pressable style={s.photoButton} onPress={pick}><Ionicons name="camera-outline" size={18} color={colors.blue}/><Text style={s.addText}>{value?'Cambiar imagen':'Seleccionar imagen'}</Text></Pressable></View>}
const isEmpty=(value:any)=>value===undefined||value===null||value===''||(Array.isArray(value)&&value.length===0);
const signatureCss='.m-signature-pad{box-shadow:none;border:none}.m-signature-pad--body{border:1px solid #d8dfeb;border-radius:12px}.m-signature-pad--footer{margin:8px 0}.button{background:#1d4ed8;color:white;border-radius:8px}';
const s=StyleSheet.create({back:{flexDirection:'row',alignItems:'center',gap:7},backText:{fontSize:12,fontWeight:'800',color:colors.ink},section:{fontSize:11,fontWeight:'900',textTransform:'uppercase',color:colors.muted},label:{fontSize:13,fontWeight:'900',color:colors.ink},required:{color:colors.red},input:{minHeight:50,borderWidth:1,borderColor:colors.line,borderRadius:13,paddingHorizontal:13,fontSize:14,color:colors.ink,backgroundColor:'white'},textarea:{height:105,paddingTop:13,textAlignVertical:'top'},choices:{gap:8,marginTop:4},choice:{minHeight:44,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:6},choiceText:{flex:1,fontSize:13,color:colors.ink},rating:{flexDirection:'row',gap:10,paddingVertical:8},photo:{width:'100%',height:190,borderRadius:14,marginBottom:10},photoButton:{height:48,borderWidth:1,borderColor:colors.line,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},signature:{height:260},saved:{fontSize:11,fontWeight:'800',color:colors.green,textAlign:'center'},group:{gap:10},groupRow:{gap:10},subField:{gap:6},subLabel:{fontSize:11,fontWeight:'800',color:colors.muted},separator:{height:1,backgroundColor:colors.line,marginVertical:5},remove:{fontSize:11,fontWeight:'800',color:colors.red,textAlign:'right'},add:{height:46,borderWidth:1,borderColor:colors.line,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},addText:{fontSize:12,fontWeight:'900',color:colors.blue},submit:{height:56,borderRadius:15,backgroundColor:colors.green,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},submitText:{fontSize:14,fontWeight:'900',color:'white'},disabled:{opacity:.45},help:{fontSize:13,color:colors.muted,textAlign:'center'}});
