import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Screen } from '@/components/ui';
import { useSupabaseList } from '@/hooks/useSupabaseList';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { canAccessWork, type Work } from '@/lib/types';
export default function Works(){const{profile}=useAuth();const state=useSupabaseList<Work>(async()=>{const{data,error}=await supabase.from('obras').select('id,nombre,estado,cliente,tipo,area,empresa').eq('empresa',profile!.empresa).order('nombre');if(error)throw error;return (data||[]).filter(work=>canAccessWork(profile,work.nombre))},`${profile?.empresa}-${profile?.obras}`);return <Screen refreshing={state.loading} onRefresh={state.refresh}><Header title="Obras" subtitle="Avance, recursos y control en terreno." icon="business-outline"/><ErrorBox text={state.error}/>{state.loading&&!state.data.length?<Loading/>:!state.data.length?<Empty text="No hay obras disponibles para tu perfil."/>:state.data.map(w=><Card key={w.id} onPress={()=>router.push({pathname:'/obra/[id]',params:{id:String(w.id),nombre:w.nombre}})}><View style={s.top}><Badge tone={String(w.estado).toLowerCase().includes('activa')?'green':'amber'}>{w.estado||'Sin estado'}</Badge><Ionicons name="arrow-forward-circle" size={25} color={colors.orange}/></View><Text style={s.name}>{w.nombre}</Text><Text style={s.meta}>{w.tipo||w.area||'Obra'}{w.cliente?` Â· ${w.cliente}`:''}</Text></Card>)}</Screen>}
const s=StyleSheet.create({top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},name:{fontSize:17,fontWeight:'900',color:colors.ink},meta:{fontSize:12,color:colors.muted}});

