import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Screen, SearchField } from '@/components/ui';
import { useSupabaseList } from '@/hooks/useSupabaseList';
import { supabase } from '@/lib/supabase';

import { canAccessWork, type Work } from '@/lib/types';
import { workDescription, workStatus } from '@/lib/workPresentation';

export default function Works() {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);

  const { profile } = useAuth();
  const [search,setSearch] = useState('');
  const state = useSupabaseList<Work>(async () => {
    const { data, error } = await supabase.from('obras').select('id,nombre,estado,cliente,tipo,area,empresa').eq('empresa', profile!.empresa).order('nombre');
    if (error) throw error;
    return (data || []).filter(work => canAccessWork(profile, work.nombre));
  }, `${profile?.empresa}-${profile?.obras}`);
  const works = useMemo(()=>state.data.filter(work=>`${work.nombre} ${work.cliente || ''} ${work.tipo || ''}`.toLocaleLowerCase('es-CL').includes(search.toLocaleLowerCase('es-CL'))),[state.data,search]);
  return <Screen refreshing={state.loading} onRefresh={state.refresh}>
    <Header title="Obras" subtitle="Avance, recursos y control en terreno." icon="business-outline"/>
    <SearchField value={search} onChangeText={setSearch} placeholder="Buscar obra o cliente"/>
    {!state.loading&&<Text style={s.count}>{works.length} {works.length===1?'obra disponible':'obras disponibles'}</Text>}
    <ErrorBox text={state.error}/>
    {state.loading && !state.data.length ? <Loading/> : !works.length ? <Empty text={search?'No encontramos obras con esa búsqueda.':'No hay obras disponibles para tu perfil.'}/> : works.map(work => {
      const status = workStatus(work);
      return <Card key={work.id} onPress={() => router.push({pathname:'/obra/[id]',params:{id:String(work.id),nombre:work.nombre}})}>
        <View style={s.top}><View style={s.workIcon}><Ionicons name="business-outline" size={20} color={colors.blue}/></View><Badge tone={status.tone}>{status.label}</Badge></View>
        <View style={s.heading}><View style={s.description}><Text style={s.name}>{work.nombre}</Text><Text style={s.meta}>{workDescription(work)}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></View>
      </Card>;
    })}
  </Screen>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({count:{fontSize:12,color:colors.muted},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},workIcon:{width:38,height:38,borderRadius:10,backgroundColor:colors.blueSoft,alignItems:'center',justifyContent:'center'},heading:{flexDirection:'row',alignItems:'center',gap:12},description:{flex:1,minWidth:0,gap:6},name:{fontSize:16,lineHeight:23,fontWeight:'600',color:colors.ink},meta:{fontSize:13,lineHeight:20,color:colors.muted}});

