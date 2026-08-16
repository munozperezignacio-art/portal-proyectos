/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { EquipmentManagementActions } from '@/components/EquipmentManagementActions';
import { MachineryActions } from '@/components/MachineryActions';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Screen, Segments } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Row = Record<string, any>;
const tabs = [{ key: 'historial', label: 'Historial' }, { key: 'mantenciones', label: 'Mantenciones' }, { key: 'planes', label: 'Próximas' }];
export default function EquipmentDetail() {
  const { id, obra } = useLocalSearchParams<{ id: string; obra?: string }>(); const { profile } = useAuth();
  const [tab, setTab] = useState('historial'); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [data, setData] = useState<Row>({ equipment: null, usage: [], failures: [], maintenance: [], reservations: [] });
  const load = async () => {
    setLoading(true); setError('');
    try {
      let usageQuery = supabase.from('maquinaria_uso_diario').select('*').eq('empresa', profile!.empresa).eq('equipo_id', id).order('fecha', { ascending: false });
      let failureQuery = supabase.from('maquinaria_fallas').select('*').eq('empresa', profile!.empresa).eq('equipo_id', Number(id)).order('fecha', { ascending: false });
      let maintenanceQuery = supabase.from('maquinaria_mantenciones').select('*').eq('empresa', profile!.empresa).eq('equipo_id', Number(id)).order('fecha', { ascending: false });
      if (obra) { usageQuery = usageQuery.eq('obra_nombre', obra); failureQuery = failureQuery.eq('obra_nombre', obra); maintenanceQuery = maintenanceQuery.eq('obra_nombre', obra); }
      const [equipment, usage, failures, maintenance, reservations] = await Promise.all([
        supabase.from('inventario_maquinaria').select('*').eq('empresa', profile!.empresa).eq('id', Number(id)).maybeSingle(), usageQuery, failureQuery, maintenanceQuery,
        supabase.from('maquinaria_reservas').select('*').eq('empresa', profile!.empresa).eq('equipo_id', id).order('fecha_inicio', { ascending: false }),
      ]);
      const failure = [equipment, usage, failures, maintenance, reservations].find(result => result.error); if (failure?.error) throw failure.error;
      setData({ equipment: equipment.data, usage: usage.data || [], failures: failures.data || [], maintenance: maintenance.data || [], reservations: reservations.data || [] });
    } catch (x) { setError(x instanceof Error ? x.message : 'No fue posible cargar el equipo.'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id, obra, profile?.empresa]);
  const history = useMemo(() => [...data.usage.map((item: Row) => ({ ...item, kind: 'Uso', sortDate: item.fecha || item.created_at })), ...data.failures.map((item: Row) => ({ ...item, kind: 'Falla', sortDate: item.fecha || item.created_at })), ...data.maintenance.map((item: Row) => ({ ...item, kind: 'Mantención', sortDate: item.fecha || item.created_at }))].sort((a: Row, b: Row) => String(b.sortDate).localeCompare(String(a.sortDate))), [data]);
  const plans = useMemo(() => (Array.isArray(data.equipment?.planes_mantencion) ? data.equipment.planes_mantencion : []).map((plan: Row) => { const current = Number(data.equipment?.horometro_inicial || 0), last = Number(plan.ultima_lectura || 0), interval = Number(plan.intervalo || 0); return { ...plan, remaining: interval - (current - last), next: last + interval }; }).sort((a: Row, b: Row) => a.remaining - b.remaining), [data.equipment]);
  const hours = data.usage.reduce((sum: number, item: Row) => sum + Number(item.horas_trabajadas || 0), 0); const equipment = data.equipment;
  return <Screen refreshing={loading} onRefresh={load}>
    <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={20} /><Text style={s.backText}>Volver</Text></Pressable>
    <Header title={equipment ? `${equipment.tipo || 'Equipo'} · ${equipment.patente || 'S/P'}` : 'Ficha del equipo'} subtitle={obra ? `Historial exclusivo de ${obra}` : 'Historial completo de la empresa'} icon="construct-outline" />
    <ErrorBox text={error} />{loading && !equipment ? <Loading /> : equipment ? <>
      <Card><View style={s.row}><View style={s.flex}><Text style={s.name}>{equipment.marca || 'Marca no informada'}</Text><Text style={s.meta}>{equipment.obra_nombre || 'Bodega / Sin asignar'} · Lectura actual {Number(equipment.horometro_inicial || 0).toLocaleString('es-CL')}</Text></View><Badge tone={String(equipment.estado_equipo).toLowerCase().includes('mant') ? 'amber' : 'green'}>{equipment.estado_equipo || 'Operativo'}</Badge></View></Card>
      <View style={s.actions}><MachineryActions mode="usage" equipment={[equipment]} initialEquipment={equipment} profile={profile!} onSaved={load} /><MachineryActions mode="failure" equipment={[equipment]} initialEquipment={equipment} profile={profile!} onSaved={load} /><EquipmentManagementActions equipment={[equipment]} initialEquipment={equipment} maintenanceOnly profile={profile!} onSaved={load} /></View>
      <View style={s.metrics}><Metric value={hours.toLocaleString('es-CL')} label="Horas registradas" /><Metric value={data.failures.length} label="Fallas" /><Metric value={data.maintenance.length} label="Mantenciones" /></View>
      <Segments value={tab} options={tabs} onChange={setTab} />
      {tab === 'historial' && (history.length ? history.map((item: Row) => <HistoryCard key={`${item.kind}-${item.id}`} item={item} />) : <Empty text="No hay movimientos registrados para este alcance." />)}
      {tab === 'mantenciones' && (data.maintenance.length ? data.maintenance.map((item: Row) => <Card key={item.id}><Badge tone="green">{item.tipo || 'Mantención'}</Badge><Text style={s.name}>{item.fecha} · Lectura {Number(item.horometro || 0).toLocaleString('es-CL')}</Text><Text style={s.meta}>{item.descripcion || 'Sin descripción'}{item.proveedor ? ` · ${item.proveedor}` : ''}</Text><Text style={s.cost}>${Number(item.costo || 0).toLocaleString('es-CL')}</Text></Card>) : <Empty text="No hay mantenciones registradas." />)}
      {tab === 'planes' && (plans.length ? plans.map((plan: Row, index: number) => <Card key={`${plan.nombre}-${index}`}><Badge tone={plan.remaining <= 0 ? 'red' : plan.remaining <= 10 ? 'amber' : 'green'}>{plan.remaining <= 0 ? 'Vencida' : 'Programada'}</Badge><Text style={s.name}>{plan.nombre || 'Mantención preventiva'}</Text><Text style={s.meta}>Próxima lectura: {plan.next.toLocaleString('es-CL')} {plan.unidad || 'horas'} · {Math.max(0, plan.remaining).toLocaleString('es-CL')} restantes</Text></Card>) : <Empty text="Este equipo no tiene planes de mantención configurados." />)}
    </> : <Empty text="El equipo no existe o no está disponible para tu empresa." />}
  </Screen>;
}
function HistoryCard({ item }: { item: Row }) { const failure = item.kind === 'Falla', maintenance = item.kind === 'Mantención'; return <Card><Badge tone={failure ? 'red' : maintenance ? 'amber' : 'green'}>{item.kind}</Badge><Text style={s.name}>{item.fecha || String(item.created_at).slice(0, 10)}</Text><Text style={s.meta}>{failure ? `${item.descripcion || 'Sin descripción'} · ${item.horas_fuera_servicio || 0} h fuera de servicio` : maintenance ? `${item.tipo || ''} · ${item.descripcion || 'Sin descripción'}` : `${Number(item.horas_trabajadas || 0).toLocaleString('es-CL')} h · ${item.operador || 'Sin operador'}${item.observaciones ? ` · ${item.observaciones}` : ''}`}</Text></Card>; }
function Metric({ value, label }: { value: string | number; label: string }) { return <Card><Text style={s.value}>{value}</Text><Text style={s.meta}>{label}</Text></Card>; }
const s = StyleSheet.create({ back: { flexDirection: 'row', alignItems: 'center', gap: 7 }, backText: { fontSize: 12, fontWeight: '800', color: colors.ink }, actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, flex: { flex: 1 }, name: { fontSize: 14, fontWeight: '900', color: colors.ink }, meta: { fontSize: 11, color: colors.muted, lineHeight: 16 }, metrics: { flexDirection: 'row', gap: 8 }, value: { fontSize: 22, fontWeight: '900', color: colors.blue }, cost: { fontSize: 14, fontWeight: '900', color: colors.green } });
