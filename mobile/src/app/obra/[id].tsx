import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { WorkPartReports } from '@/components/WorkPartReports';
import { WorkStatistics } from '@/components/WorkStatistics';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Screen, Segments } from '@/components/ui';
import { ManualAttendance } from '@/components/ManualAttendance';
import { WorkEntryActions } from '@/components/WorkEntryActions';
import { supabase } from '@/lib/supabase';

import { can, canAccessWork } from '@/lib/types';

import { assignedWorkPersonnel,loadPersonnelSources } from '@/lib/workPersonnel';
import { localToday } from '@/lib/statisticsDashboard';
import { normalizeParts, productionMetrics } from '@/lib/workStatistics';

type Row = Record<string, any>;
const tabs = [
  { key: 'avance', label: 'Avance' }, { key: 'equipos', label: 'Maquinaria' },
  { key: 'asistencia', label: 'Asistencia' }, { key: 'subcontratos', label: 'Subcontratos' },
  { key: 'estadisticas', label: 'Estadísticas' },
];
const day = (value: any) => String(value || '').slice(0, 10);
const today = localToday;


export default function WorkDetail() {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);

  const { id, nombre } = useLocalSearchParams<{ id: string; nombre: string }>();
  const { profile } = useAuth();
  const authorized = canAccessWork(profile, nombre);
  const [tab, setTab] = useState(() => can(profile,'obras.avances.ver') ? 'avance' : can(profile,'obras.maquinaria.ver') ? 'equipos' : can(profile,'obras.personal.ver') ? 'asistencia' : can(profile,'obras.subcontratos.ver') ? 'subcontratos' : 'estadisticas'); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [expandedAttendance, setExpandedAttendance] = useState<string | null>(null);
  const [data, setData] = useState<Row>({ work: null, parts: [], adv: [], equip: [], attendance: [], workers: [], sub: [], subAdv: [], subAttendance: [], subPayments: [], maintenance: [] });
  const load = async () => {
    setLoading(true); setError('');
    if (!authorized) { setError('No tienes acceso asignado a esta obra.'); setLoading(false); return; }
    try {
      const work=await supabase.from('obras').select('*').eq('empresa',profile!.empresa).eq('id',Number(id)).maybeSingle();
      if(work.error)throw work.error;
      if(!work.data||!canAccessWork(profile,work.data.nombre))throw new Error('No tienes acceso a esta obra o ya no está disponible.');
      const canonicalName=work.data.nombre;
      const [p, a, e, att, w, sub, sa, sat, sep, m] = await Promise.all([
        supabase.from('partidas_obra').select('*').eq('empresa', profile!.empresa).eq('obra_id', Number(id)).order('orden'),
        supabase.from('avances_produccion_partidas').select('*').eq('empresa', profile!.empresa).eq('obra_id', Number(id)),
        supabase.from('inventario_maquinaria').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', canonicalName),
        supabase.from('asistencia_personal').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', canonicalName).order('created_at', { ascending: false }).limit(400),
        loadPersonnelSources(supabase,profile!.empresa),
        supabase.from('acreditaciones_subcontratos').select('*').eq('empresa', profile!.empresa).eq('obra_asociada', canonicalName),
        supabase.from('subcontrato_avances').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', canonicalName).order('fecha', { ascending: false }).limit(100),
        supabase.from('subcontrato_asistencia').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', canonicalName).order('fecha', { ascending: false }).limit(100),
        supabase.from('subcontrato_estados_pago').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', canonicalName).order('created_at', { ascending: false }).limit(100),
        supabase.from('maquinaria_mantenciones').select('*').eq('empresa', profile!.empresa).order('fecha', { ascending: false }),
      ]);
      const failure = [p, a, e, att, sub, sa, sat, sep, m].find(result => result.error);
      if (failure?.error) throw failure.error;
      const relation = await supabase.from('obra_presupuestos').select('presupuesto_id').eq('empresa', profile!.empresa).eq('obra_nombre', canonicalName).maybeSingle();
      if (relation.error) throw relation.error;
      let budgetRows: Row[] = []; let scheduleRows: Row[] = [];
      if (relation.data?.presupuesto_id) {
        const [budget, schedule] = await Promise.all([
          supabase.from('presupuestos_items').select('codigo,partida').eq('presupuesto_id', relation.data.presupuesto_id),
          supabase.from('planificacion_cronogramas').select('*').eq('presupuesto_id', relation.data.presupuesto_id),
        ]);
        if (budget.error || schedule.error) throw budget.error || schedule.error;
        budgetRows = budget.data || []; scheduleRows = schedule.data || [];
      }
      const projectStart = day(work.data?.fecha_inicio_real || work.data?.fecha_inicio || work.data?.created_at) || today();
      const parts = normalizeParts(p.data || [], budgetRows, scheduleRows, projectStart);
      const equipment = e.data || []; const ids = new Set(equipment.map(item => item.id));
      setData({ work: work.data, parts, adv: a.data || [], equip: equipment, attendance: att.data || [], workers: assignedWorkPersonnel(w,work.data,today()), sub: sub.data || [], subAdv: sa.data || [], subAttendance: sat.data || [], subPayments: sep.data || [], maintenance: (m.data || []).filter(item => ids.has(item.equipo_id)) });
    } catch (x) { setError(x instanceof Error ? x.message : 'No fue posible cargar la obra.'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id, profile, nombre, authorized]);

  const metrics = useMemo(() => {
    const cutoff = today();
    const { detail, progress, planned } = productionMetrics(data.parts, data.adv, cutoff);
    const latest = data.attendance.map((item: Row) => day(item.fecha_marcacion || item.created_at)).filter(Boolean).sort().at(-1);
    const present = new Set(data.attendance.filter((item: Row) => day(item.fecha_marcacion || item.created_at) === latest && String(item.asistencia).toLowerCase().includes('pres')).map((item: Row) => item.rut || item.trabajador));
    return { detail, progress, planned, present: present.size, total: data.workers.length, latest };
  }, [data]);
  const upcoming = useMemo(() => data.equip.flatMap((item: Row) => (Array.isArray(item.planes_mantencion) ? item.planes_mantencion : []).map((plan: Row) => ({ item, plan, remaining: Number(plan.intervalo || 0) - (Number(item.horometro_inicial || 0) - Number(plan.ultima_lectura || 0)) }))).sort((a: Row, b: Row) => a.remaining - b.remaining), [data.equip]);
  const attendanceDays = useMemo(() => (Object.values(data.attendance.reduce((groups: Record<string, Row>, item: Row) => { const date = day(item.fecha_marcacion || item.created_at) || 'Sin fecha'; if (!groups[date]) groups[date] = { date, rows: [] }; groups[date].rows.push(item); return groups; }, {})) as Row[]).map((group: Row) => { const unique = new Map(group.rows.map((item: Row) => [String(item.rut || item.trabajador || item.id), item])); const rows = [...unique.values()] as Row[]; return { ...group, rows, present: rows.filter(item => String(item.asistencia || item.estado || '').toLowerCase().includes('pres')).length, absent: rows.filter(item => !String(item.asistencia || item.estado || '').toLowerCase().includes('pres')).length }; }).sort((a: Row, b: Row) => String(b.date).localeCompare(String(a.date))), [data.attendance]);


  return <Screen refreshing={loading} onRefresh={load}>
    <Pressable onPress={() => router.back()} style={s.back}><Ionicons color={colors.ink} name="arrow-back" size={20} /><Text style={s.backText}>Volver a obras</Text></Pressable>
    <Header title={data.work?.nombre || nombre || 'Obra'} subtitle="Vista operativa en terreno" icon="business-outline" />
    <Segments value={tab} options={tabs.filter(item => item.key === 'avance' ? can(profile,'obras.avances.ver') : item.key === 'equipos' ? can(profile,'obras.maquinaria.ver') : item.key === 'asistencia' ? can(profile,'obras.personal.ver') : item.key === 'subcontratos' ? can(profile,'obras.subcontratos.ver') : true)} onChange={setTab} />
    {tab === 'avance' && can(profile,'obras.avances.crear') && <WorkEntryActions mode="progress" profile={profile!} workId={Number(id)} workName={data.work?.nombre || nombre || ''} parts={data.parts} onSaved={load} />}
    {tab === 'asistencia' && data.work && can(profile,'obras.personal.crear') && <ManualAttendance profile={profile!} workId={Number(id)} workName={data.work?.nombre || nombre || ''} work={data.work} onSaved={load} />}
    <ErrorBox text={error} />
    {loading && !data.parts.length ? <Loading /> : <>
      {tab === 'avance' && authorized && can(profile,'obras.avances.ver') && (metrics.detail.length ? <WorkPartReports key={id} parts={metrics.detail} reports={data.adv} cutoff={today()}/> : <Empty text="La obra aún no tiene partidas cargadas." />)}
      {tab === 'equipos' && <><Text style={s.help}>Selecciona un equipo para ver su historial y las acciones que tu rol puede realizar en esta obra.</Text>{data.equip.length ? data.equip.map((item: Row) => <Card key={item.id} onPress={() => router.push({ pathname: '/equipo/[id]', params: { id: String(item.id), obra: nombre || '' } })}><View style={s.row}><View style={s.flex}><Text style={s.name}>{item.tipo} · {item.patente || 'S/P'}</Text><Text style={s.meta}>{item.marca || 'Sin marca'} · Lectura {Number(item.horometro_inicial || 0).toLocaleString('es-CL')}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></View></Card>) : <Empty text="No hay equipos asignados a esta obra." />}<Text style={s.section}>Próximas mantenciones</Text>{upcoming.length ? upcoming.slice(0, 8).map((entry: Row, index: number) => <Card key={`${entry.item.id}-${index}`}><Badge tone={entry.remaining <= 0 ? 'red' : entry.remaining <= 10 ? 'amber' : 'green'}>{entry.remaining <= 0 ? 'Vencida' : 'Próxima'}</Badge><Text style={s.name}>{entry.item.tipo} · {entry.item.patente}</Text><Text style={s.meta}>{entry.plan.nombre || 'Mantención'} · {Math.max(0, entry.remaining)} {entry.plan.unidad || 'horas'} restantes</Text></Card>) : <Empty text="No hay planes de mantención configurados." />}</>}
      {tab === 'asistencia' && <><Card><Text style={s.metric}>{metrics.present} de {metrics.total}</Text><Text style={s.meta}>presentes en la última jornada registrada {metrics.latest || ''}</Text></Card><Text style={s.section}>Historial de asistencia</Text>{attendanceDays.length ? attendanceDays.map((group: Row) => <Card key={group.date} onPress={() => setExpandedAttendance(value => value === group.date ? null : group.date)}><View style={s.row}><View style={s.flex}><Text style={s.name}>{group.date}</Text><Text style={s.meta}>{group.present} presentes · {group.absent} ausentes · {group.rows.length} registros</Text></View><Ionicons name={expandedAttendance === group.date ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted}/></View>{expandedAttendance === group.date && <View style={s.attendanceList}>{group.rows.map((item: Row) => { const present = String(item.asistencia || item.estado || '').toLowerCase().includes('pres'); return <View key={item.id || `${item.rut}-${item.trabajador}`} style={s.attendanceRow}><Ionicons name={present ? 'checkmark-circle' : 'close-circle'} size={18} color={present ? colors.green : colors.red}/><View style={s.flex}><Text style={s.attendanceName}>{item.trabajador || item.nombre || item.rut || 'Trabajador'}</Text><Text style={s.meta}>{item.cargo || item.rut || ''}</Text><Text style={s.meta}>Otras horas: {Number(item.otras_horas||0).toLocaleString('es-CL')} h</Text></View><Badge tone={present ? 'green' : 'red'}>{present ? 'Presente' : (item.asistencia || item.estado || 'Ausente')}</Badge></View>})}</View>}</Card>) : <Empty text="Todavía no hay jornadas de asistencia registradas."/>}</>}
      {tab === 'subcontratos' && <>{data.sub.length ? data.sub.map((item: Row) => <Card key={item.id} onPress={() => router.push({ pathname: '/subcontrato/[id]', params: { id: String(item.id), obra: nombre || '', nombre: item.empresa_nombre || 'Subcontrato' } })}><View style={s.row}><View style={s.flex}><Text style={s.name}>{item.empresa_nombre || 'Subcontrato'}</Text><Text style={s.meta}>{item.rut_empresa || ''} · {item.estado_cumplimiento || item.estado || 'Activo'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View></Card>) : <Empty text="No hay subcontratos registrados." />}<View style={s.stats}><Metric value={data.subAdv.length} label="Avances enviados" /><Metric value={data.subAttendance.length} label="Asistencias" /><Metric value={data.subPayments.length} label="Estados de pago" /></View></>}
      {tab === 'estadisticas' && authorized && <WorkStatistics data={data} upcoming={upcoming} onNavigate={setTab} access={{avance:can(profile,'obras.avances.ver'),equipos:can(profile,'obras.maquinaria.ver'),asistencia:can(profile,'obras.personal.ver')}}/>}
    </>}
  </Screen>;
}

function Metric({ value, label }: { value: number; label: string }) {
  const s=useThemedStyles(createStyles);
 return <Card><Text style={s.metricSmall}>{value}</Text><Text style={s.meta}>{label}</Text></Card>; }
const createStyles = (colors: ThemeColors) => StyleSheet.create({ back: { flexDirection: 'row', alignItems: 'center', gap: 7 }, backText: { fontSize: 12, fontWeight:'600', color: colors.ink }, actions: { flexDirection: 'row', gap: 8 }, help:{fontSize:12,color:colors.muted,lineHeight:18,paddingHorizontal:2}, section: { fontSize: 12, fontWeight:'700', textTransform: 'uppercase', color: colors.ink }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 }, name: { fontSize: 14, fontWeight:'700', color: colors.ink }, meta: { fontSize:12, color: colors.muted }, metric: { fontSize: 28, fontWeight:'700', color: colors.green }, warning: { color: colors.orange }, metricSmall: { fontSize: 24, fontWeight:'700', color: colors.blue }, label: { fontSize:12, fontWeight:'600', textTransform: 'uppercase', color: colors.muted }, stats: { flexDirection: 'row', gap: 10 },attendanceList:{marginTop:10,borderTopWidth:1,borderTopColor:colors.line},attendanceRow:{minHeight:50,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:colors.line},attendanceName:{fontSize:12,fontWeight:'600',color:colors.ink} });
