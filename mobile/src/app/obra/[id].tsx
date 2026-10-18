/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { SimpleBars } from '@/components/SimpleBars';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Progress, Screen, Segments } from '@/components/ui';
import { ManualAttendance } from '@/components/ManualAttendance';
import { WorkEntryActions } from '@/components/WorkEntryActions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { can, canAccessWork } from '@/lib/types';

import { countChileanBusinessDays, shiftChileanBusinessDays, normalizeParts, productionMetrics } from '@/lib/workStatistics';

type Row = Record<string, any>;
const tabs = [
  { key: 'avance', label: 'Avance' }, { key: 'equipos', label: 'Maquinaria' },
  { key: 'asistencia', label: 'Asistencia' }, { key: 'subcontratos', label: 'Subcontratos' },
  { key: 'estadisticas', label: 'Estadísticas' },
];
const day = (value: any) => String(value || '').slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const businessDays = countChileanBusinessDays;
const shiftBusinessDays = shiftChileanBusinessDays;

export default function WorkDetail() {
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
      const [work, p, a, e, att, w, sub, sa, sat, sep, m] = await Promise.all([
        supabase.from('obras').select('*').eq('empresa', profile!.empresa).eq('id', Number(id)).maybeSingle(),
        supabase.from('partidas_obra').select('*').eq('empresa', profile!.empresa).eq('obra_id', Number(id)).order('orden'),
        supabase.from('avances_produccion_partidas').select('*').eq('empresa', profile!.empresa).eq('obra_id', Number(id)),
        supabase.from('inventario_maquinaria').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', nombre),
        supabase.from('asistencia_personal').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', nombre).order('created_at', { ascending: false }).limit(400),
        supabase.from('maestro_personal').select('id,nombre,rut,cargo').eq('empresa', profile!.empresa).eq('obra_nombre', nombre),
        supabase.from('acreditaciones_subcontratos').select('*').eq('empresa', profile!.empresa).eq('obra_asociada', nombre),
        supabase.from('subcontrato_avances').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', nombre).order('fecha', { ascending: false }).limit(100),
        supabase.from('subcontrato_asistencia').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', nombre).order('fecha', { ascending: false }).limit(100),
        supabase.from('subcontrato_estados_pago').select('*').eq('empresa', profile!.empresa).eq('obra_nombre', nombre).order('created_at', { ascending: false }).limit(100),
        supabase.from('maquinaria_mantenciones').select('*').eq('empresa', profile!.empresa).order('fecha', { ascending: false }),
      ]);
      const failure = [work, p, a, e, att, w, sub, sa, sat, sep, m].find(result => result.error);
      if (failure?.error) throw failure.error;
      const relation = await supabase.from('obra_presupuestos').select('presupuesto_id').eq('empresa', profile!.empresa).eq('obra_nombre', nombre).maybeSingle();
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
      setData({ work: work.data, parts, adv: a.data || [], equip: equipment, attendance: att.data || [], workers: w.data || [], sub: sub.data || [], subAdv: sa.data || [], subAttendance: sat.data || [], subPayments: sep.data || [], maintenance: (m.data || []).filter(item => ids.has(item.equipo_id)) });
    } catch (x) { setError(x instanceof Error ? x.message : 'No fue posible cargar la obra.'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id, profile, nombre, authorized]);

  const metrics = useMemo(() => {
    const cutoff = today();
    const { detail, progress, planned } = productionMetrics(data.parts, data.adv, cutoff);
    const start = detail.map((p: Row) => day(p.baselineStart || p.fecha_inicio)).filter(Boolean).sort()[0] || day(data.work?.fecha_inicio_real || data.work?.fecha_inicio || data.work?.created_at);
    const fallbackEnd = new Date(`${day(data.work?.fecha_inicio_real || data.work?.fecha_inicio || data.work?.created_at) || cutoff}T00:00:00`);
    fallbackEnd.setDate(fallbackEnd.getDate() + 90);
    const finish = day(data.work?.fecha_termino_estimada || data.work?.fecha_termino) || day(fallbackEnd.toISOString());
    const totalDays = start && finish ? Math.max(1, businessDays(start, finish)) : 0;
    const scheduleDays = totalDays ? Math.round(((progress - planned) / 100) * totalDays) : null;
    const projectedFinish = finish && scheduleDays !== null ? shiftBusinessDays(finish, -scheduleDays) : '';
    const latest = data.attendance.map((item: Row) => day(item.fecha_marcacion || item.created_at)).filter(Boolean).sort().at(-1);
    const present = new Set(data.attendance.filter((item: Row) => day(item.fecha_marcacion || item.created_at) === latest && String(item.asistencia).toLowerCase().includes('pres')).map((item: Row) => item.rut || item.trabajador));
    const recentReports = data.adv.filter((a: Row) => day(a.created_at) <= cutoff && businessDays(day(a.created_at), cutoff) <= 7).length;
    return { detail, progress, planned, scheduleDays, projectedFinish, contractualFinish: finish, delayed: detail.filter((p: Row) => p.scheduleDays < 0).length, completed: detail.filter((p: Row) => p.pct >= 100).length, noProgress: detail.filter((p: Row) => p.planned > 0 && p.pct === 0).length, recentReports, present: present.size, total: data.workers.length, latest };
  }, [data]);
  const upcoming = useMemo(() => data.equip.flatMap((item: Row) => (Array.isArray(item.planes_mantencion) ? item.planes_mantencion : []).map((plan: Row) => ({ item, plan, remaining: Number(plan.intervalo || 0) - (Number(item.horometro_inicial || 0) - Number(plan.ultima_lectura || 0)) }))).sort((a: Row, b: Row) => a.remaining - b.remaining), [data.equip]);
  const attendanceDays = useMemo(() => (Object.values(data.attendance.reduce((groups: Record<string, Row>, item: Row) => { const date = day(item.fecha_marcacion || item.created_at) || 'Sin fecha'; if (!groups[date]) groups[date] = { date, rows: [] }; groups[date].rows.push(item); return groups; }, {})) as Row[]).map((group: Row) => { const unique = new Map(group.rows.map((item: Row) => [String(item.rut || item.trabajador || item.id), item])); const rows = [...unique.values()] as Row[]; return { ...group, rows, present: rows.filter(item => String(item.asistencia || item.estado || '').toLowerCase().includes('pres')).length, absent: rows.filter(item => !String(item.asistencia || item.estado || '').toLowerCase().includes('pres')).length }; }).sort((a: Row, b: Row) => String(b.date).localeCompare(String(a.date))), [data.attendance]);
  const progressByPart = useMemo(() => metrics.detail.slice().sort((a: Row, b: Row) => a.scheduleDays - b.scheduleDays).slice(0, 10).map((part: Row) => ({ label: part.partida, value: part.pct, display: `${part.pct.toFixed(1)}% · ${part.scheduleDays === 0 ? 'en plazo' : `${Math.abs(part.scheduleDays)} d ${part.scheduleDays > 0 ? 'ganados' : 'perdidos'}`}`, color: part.scheduleDays < 0 ? colors.orange : part.pct >= 100 ? colors.green : colors.blue })), [metrics.detail]);

  return <Screen refreshing={loading} onRefresh={load}>
    <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={20} /><Text style={s.backText}>Volver a obras</Text></Pressable>
    <Header title={nombre || 'Obra'} subtitle="Vista operativa en terreno" icon="business-outline" />
    <Segments value={tab} options={tabs.filter(item => item.key === 'avance' ? can(profile,'obras.avances.ver') : item.key === 'equipos' ? can(profile,'obras.maquinaria.ver') : item.key === 'asistencia' ? can(profile,'obras.personal.ver') : item.key === 'subcontratos' ? can(profile,'obras.subcontratos.ver') : true)} onChange={setTab} />
    {tab === 'avance' && can(profile,'obras.avances.crear') && <WorkEntryActions mode="progress" profile={profile!} workId={Number(id)} workName={nombre || ''} parts={data.parts} onSaved={load} />}
    {tab === 'asistencia' && can(profile,'obras.personal.crear') && <ManualAttendance profile={profile!} workId={Number(id)} workName={nombre || ''} work={data.work} onSaved={load} />}
    <ErrorBox text={error} />
    {loading && !data.parts.length ? <Loading /> : <>
      {tab === 'avance' && (metrics.detail.length ? metrics.detail.map((part: Row) => <Card key={part.id}><Text style={s.name}>{part.partida}</Text><Text style={s.meta}>{part.done.toLocaleString('es-CL')} de {Number(part.cantidad_presupuestada || 0).toLocaleString('es-CL')} {part.unidad}</Text><Progress value={part.pct} /></Card>) : <Empty text="La obra aún no tiene partidas cargadas." />)}
      {tab === 'equipos' && <><Text style={s.help}>Selecciona un equipo para ver su historial y las acciones que tu rol puede realizar en esta obra.</Text>{data.equip.length ? data.equip.map((item: Row) => <Card key={item.id} onPress={() => router.push({ pathname: '/equipo/[id]', params: { id: String(item.id), obra: nombre || '' } })}><View style={s.row}><View style={s.flex}><Text style={s.name}>{item.tipo} · {item.patente || 'S/P'}</Text><Text style={s.meta}>{item.marca || 'Sin marca'} · Lectura {Number(item.horometro_inicial || 0).toLocaleString('es-CL')}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></View></Card>) : <Empty text="No hay equipos asignados a esta obra." />}<Text style={s.section}>Próximas mantenciones</Text>{upcoming.length ? upcoming.slice(0, 8).map((entry: Row, index: number) => <Card key={`${entry.item.id}-${index}`}><Badge tone={entry.remaining <= 0 ? 'red' : entry.remaining <= 10 ? 'amber' : 'green'}>{entry.remaining <= 0 ? 'Vencida' : 'Próxima'}</Badge><Text style={s.name}>{entry.item.tipo} · {entry.item.patente}</Text><Text style={s.meta}>{entry.plan.nombre || 'Mantención'} · {Math.max(0, entry.remaining)} {entry.plan.unidad || 'horas'} restantes</Text></Card>) : <Empty text="No hay planes de mantención configurados." />}</>}
      {tab === 'asistencia' && <><Card><Text style={s.metric}>{metrics.present} de {metrics.total}</Text><Text style={s.meta}>presentes en la última jornada registrada {metrics.latest || ''}</Text></Card><Text style={s.section}>Historial de asistencia</Text>{attendanceDays.length ? attendanceDays.map((group: Row) => <Card key={group.date} onPress={() => setExpandedAttendance(value => value === group.date ? null : group.date)}><View style={s.row}><View style={s.flex}><Text style={s.name}>{group.date}</Text><Text style={s.meta}>{group.present} presentes · {group.absent} ausentes · {group.rows.length} registros</Text></View><Ionicons name={expandedAttendance === group.date ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted}/></View>{expandedAttendance === group.date && <View style={s.attendanceList}>{group.rows.map((item: Row) => { const present = String(item.asistencia || item.estado || '').toLowerCase().includes('pres'); return <View key={item.id || `${item.rut}-${item.trabajador}`} style={s.attendanceRow}><Ionicons name={present ? 'checkmark-circle' : 'close-circle'} size={18} color={present ? colors.green : colors.red}/><View style={s.flex}><Text style={s.attendanceName}>{item.trabajador || item.nombre || item.rut || 'Trabajador'}</Text><Text style={s.meta}>{item.cargo || item.rut || ''}</Text></View><Badge tone={present ? 'green' : 'red'}>{present ? 'Presente' : (item.asistencia || item.estado || 'Ausente')}</Badge></View>})}</View>}</Card>) : <Empty text="Todavía no hay jornadas de asistencia registradas."/>}</>}
      {tab === 'subcontratos' && <>{data.sub.length ? data.sub.map((item: Row) => <Card key={item.id} onPress={() => router.push({ pathname: '/subcontrato/[id]', params: { id: String(item.id), obra: nombre || '', nombre: item.empresa_nombre || 'Subcontrato' } })}><View style={s.row}><View style={s.flex}><Text style={s.name}>{item.empresa_nombre || 'Subcontrato'}</Text><Text style={s.meta}>{item.rut_empresa || ''} · {item.estado_cumplimiento || item.estado || 'Activo'}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted} /></View></Card>) : <Empty text="No hay subcontratos registrados." />}<View style={s.stats}><Metric value={data.subAdv.length} label="Avances enviados" /><Metric value={data.subAttendance.length} label="Asistencias" /><Metric value={data.subPayments.length} label="Estados de pago" /></View></>}
      {tab === 'estadisticas' && <>
        <Card><Text style={s.label}>Estatus de plazo</Text><Text style={[s.metric, metrics.scheduleDays !== null && metrics.scheduleDays < 0 && s.warning]}>{metrics.scheduleDays === null ? 'Sin base' : metrics.scheduleDays === 0 ? 'En plazo' : `${Math.abs(metrics.scheduleDays)} días ${metrics.scheduleDays > 0 ? 'ganados' : 'perdidos'}`}</Text><Text style={s.meta}>{metrics.projectedFinish ? `Término contractual ${metrics.contractualFinish} · proyectado ${metrics.projectedFinish}` : 'Configura las fechas del programa para habilitar la proyección.'}</Text></Card>
        <Card><Text style={s.label}>Avance físico</Text><Text style={s.metric}>{metrics.progress.toFixed(1)}%</Text><Text style={s.meta}>Plan al día: {metrics.planned.toFixed(1)}% · brecha {(metrics.progress - metrics.planned).toFixed(1)}%</Text><Progress value={metrics.progress} /></Card>
        <View style={s.stats}><Metric value={metrics.completed} label="Terminadas" /><Metric value={metrics.delayed} label="Atrasadas" /><Metric value={metrics.noProgress} label="Sin avance" /></View>
        <View style={s.stats}><Metric value={metrics.recentReports} label="Reportes 7 días" /><Metric value={data.equip.length} label="Equipos" /><Metric value={upcoming.filter((x: Row) => x.remaining <= 10).length} label="Mantenciones" /></View>
        <View style={s.stats}><Metric value={metrics.present} label={`Presentes de ${metrics.total}`} /><Metric value={data.sub.length} label="Subcontratos" /><Metric value={data.subAdv.length} label="Avances subcontrato" /></View>
        <Card><Text style={s.section}>Plazo y avance por partida</Text><Text style={s.meta}>Ordenado desde las partidas con mayor pérdida de plazo.</Text>{progressByPart.length ? <SimpleBars data={progressByPart} max={100} /> : <Text style={s.meta}>Sin partidas con avance.</Text>}</Card>
      </>}
    </>}
  </Screen>;
}

function Metric({ value, label }: { value: number; label: string }) { return <Card><Text style={s.metricSmall}>{value}</Text><Text style={s.meta}>{label}</Text></Card>; }
const s = StyleSheet.create({ back: { flexDirection: 'row', alignItems: 'center', gap: 7 }, backText: { fontSize: 12, fontWeight: '800', color: colors.ink }, actions: { flexDirection: 'row', gap: 8 }, help:{fontSize:11,color:colors.muted,lineHeight:16,paddingHorizontal:2}, section: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', color: colors.ink }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 }, name: { fontSize: 14, fontWeight: '900', color: colors.ink }, meta: { fontSize: 11, color: colors.muted }, metric: { fontSize: 28, fontWeight: '900', color: colors.green }, warning: { color: colors.orange }, metricSmall: { fontSize: 24, fontWeight: '900', color: colors.blue }, label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: colors.muted }, stats: { flexDirection: 'row', gap: 10 },attendanceList:{marginTop:10,borderTopWidth:1,borderTopColor:colors.line},attendanceRow:{minHeight:50,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:colors.line},attendanceName:{fontSize:12,fontWeight:'800',color:colors.ink} });
