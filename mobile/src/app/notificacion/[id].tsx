import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Card, ErrorBox, Header, Loading, Screen } from '@/components/ui';
import { fetchNotificationDetail, fetchNotificationRecord, NotificationRecordData, markNotificationRead, MobileNotification } from '@/lib/notifications';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotificationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [item, setItem] = useState<MobileNotification | null>(null);
  const [error, setError] = useState('');
  const [record,setRecord]=useState<NotificationRecordData|null>(null);
  useEffect(() => {
    let active = true;
    if (!profile) return;
    setItem(null); setRecord(null); setError('');
    fetchNotificationDetail(profile.id, Number(id)).then(async value => {
      if (!active) return;
      setItem(value);
      void markNotificationRead(profile.id, value.id).catch(() => undefined);
      if(value.payload?.has_record){
        const data=await fetchNotificationRecord(profile.id,value.id);if(!active)return;
        if(data?.type==='prevencion_respuestas'&&data.records.length===1){router.replace({pathname:'/registro/[id]',params:{id:String(data.records[0].id)}});return;}
        setRecord(data);return;
      }
      const p=value.payload||{},work=Number(p.obra_id);
      if(value.evento_codigo==='enex_pendiente'){router.replace('/combustibles');return;}
      if(value.evento_codigo.startsWith('solicitudes_')&&p.solicitud_id){router.replace({pathname:'/solicitudes',params:{id:String(p.solicitud_id)}});return;}
      if(p.formulario_id){router.replace({pathname:'/formulario/[id]',params:{id:String(p.formulario_id)}});return;}
      if(Number.isSafeInteger(work)&&work>0){router.replace({pathname:'/obra/[id]',params:{id:String(work),nombre:value.obra_nombre||String((p.notification_context as any)?.obra||''),especialidad:p.sesion_id?'1':undefined,seccion:value.evento_codigo.includes('maquinaria')?'equipos':value.evento_codigo.includes('asistencia')?'asistencia':value.evento_codigo.startsWith('obra_alerta_')?'estadisticas':'avance'}});return;}
      if(p.equipo_id){router.replace({pathname:'/equipo/[id]',params:{id:String(p.equipo_id)}});return;}
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'No fue posible abrir el aviso.'); });
    return () => { active = false; };
  }, [id, profile?.id]);
  const workId = Number(item?.payload?.obra_id);
  return <Screen><Pressable onPress={() => router.back()}><Text style={{ color: colors.ink, marginBottom: 16 }}>← Volver</Text></Pressable>
    <Header title={item?.asunto || 'Abriendo registro…'} subtitle={Object.values(item?.payload?.notification_context||{}).join(' · ') || item?.obra_nombre || ''} icon="document-text-outline" />
    <ErrorBox text={error} />{!item && !error ? <Loading /> : null}
    {record?.records.map(row=><Card key={row.id}><Text style={{color:colors.ink,fontWeight:'700'}}>Registro #{row.id}</Text>{row.fields.map((field,i)=><View key={i} style={{paddingVertical:10,borderBottomWidth:1,borderColor:colors.line}}><Text style={{color:colors.muted,fontSize:12}}>{field.label}</Text><Text style={{color:colors.ink,lineHeight:22}}>{typeof field.value==='boolean'?(field.value?'Sí':'No'):typeof field.value==='object'?JSON.stringify(field.value):String(field.value??'—')}</Text></View>)}</Card>)}
    {item && !item.payload?.has_record ? <Card><Text style={{ color: colors.ink, lineHeight: 24 }}>{String(item.payload?.detalle || 'Revisa la información de este aviso en la obra.')}</Text>
      <Text style={{ color: colors.muted, marginTop: 12 }}>{new Date(item.created_at).toLocaleString('es-CL')}</Text>
      {Number.isSafeInteger(workId) && workId > 0 ? <Pressable onPress={() => router.push({ pathname: '/obra/[id]', params: { id: String(workId), nombre: item.obra_nombre || '', especialidad:item.payload?.sesion_id?'1':undefined } })} style={{ paddingVertical: 18 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>Abrir obra →</Text></Pressable> : null}
    </Card> : null}
  </Screen>;
}
