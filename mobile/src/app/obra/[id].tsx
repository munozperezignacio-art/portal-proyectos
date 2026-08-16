/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { MachineryActions } from '@/components/MachineryActions';
import { SimpleBars } from '@/components/SimpleBars';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Progress, Screen, Segments } from '@/components/ui';
import { WorkEntryActions } from '@/components/WorkEntryActions';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Row = Record<string, any>;
const tabs = [
  { key: 'avance', label: 'Avance' }, { key: 'equipos', label: 'Maquinaria' },
  { key: 'asistencia', label: 'Asistencia' }, { key: 'subcontratos', label: 'Subcontratos' },
  { key: 'estadisticas', label: 'Estadísticas' },
];
const HOLIDAYS = new Set(['2026-01-01', '2026-04-03', '2026-04-04', '2026-05-01', '2026-05-21', '2026-06-07', '2026-06-29', '2026-07-16', '2026-08-15', '2026-09-18', '2026-09-19', '2026-10-12', '2026-10-31', '2026-11-01', '2026-12-08', '2026-12-25']);
const day = (value: any) => String(value || '').slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const isBusinessDay = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6 && !HOLIDAYS.has(day(date.toISOString()));
const businessDays = (startValue: string, endValue: string) => {
  if (!startValue || !endValue) return 0;
  const start = new Date(`${startValue}T00:00:00`); const end = new Date(`${endValue}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
  const sign = start <= end ? 1 : -1; const from = sign > 0 ? start : end; const to = sign > 0 ? end : start;
  let count = 0; const cursor = new Date(from);
  while (cursor <= to) { if (isBusinessDay(cursor)) count += 1; cursor.setDate(cursor.getDate() + 1); }
  return count * sign;
};
const shiftBusinessDays = (value: string, amount: number) => {
  if (!value || !amount) return value;
  const cursor = new Date(`${value}T00:00:00`); const direction = amount > 0 ? 1 : -1; let moved = 0;
  while (moved < Math.abs(Math.round(amount))) { cursor.setDate(cursor.getDate() + direction); if (isBusinessDay(cursor)) moved += 1; }
  return cursor.toISOString().slice(0, 10);
};
const pctForPart = (part: Row, advances: Row[]) => {
  const total = Number(part.cantidad_presupuestada || 0);
  const done = advances.filter(a => a.partida === part.partida).reduce((sum, a) => sum + Number(a.cantidad || 0), 0);
  return { done, pct: total > 0 ? Math.min(100, (done / total) * 100) : 0 };
};

export default function WorkDetail() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre: string }>();
  const { profile } = useAuth();
  const [tab, setTab] = useState('avance'); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [data, setData] = useState<Row>({ work: null, parts: [], adv: [], equip: [], attendance: [], workers: [], sub: [], subAdv: [], subAttendance: [], subPayments: [], maintenance: [] });
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [work, p, a, e, att, w, sub, sa, sat, sep, m] = await Promise.all([
        supabase.from('obras').select('id,nombre,estado,fecha_inicio_real,fecha_termino_estimada,fecha_termino_real').eq('empresa', profile!.empresa).eq('id', Number(id)).maybeSingle(),
        supabase.from('partidas_obra').select('id,partida,unidad,cantidad_presupuestada,es_titulo,fecha_inicio,fecha_termino,rendimiento_meta').eq('empresa', profile!.empresa).eq('obra_id', Number(id)).order('orden'),
        supabase.from('avances_produccion_partidas').select('partida,cantidad,created_at').eq('empresa', profile!.empresa).eq('obra_id', Number(id)),
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
      const equipment = e.data || []; const ids = new Set(equipment.map(item => item.id));
      setData({ work: work.data, parts: p.data || [], adv: a.data || [], equip: equipment, attendance: att.data || [], workers: w.data || [], sub: sub.data || [], subAdv: sa.data || [], subAttendance: sat.data || [], subPayments: sep.data || [], maintenance: (m.data || []).filter(item => ids.has(item.equipo_id)) });
    } catch (x) { setError(x instanceof Error ? x.message : 'No fue posible cargar la obra.'); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [id, profile, nombre]);

  const metrics = useMemo(() => {
    const parts = data.parts.filter((item: Row) => !item.es_titulo); const cutoff = today();
    const detail = parts.map((part: Row) => {
      const actual = pctForPart(part, data.adv); const start = day(part.fecha_inicio);
      const duration = start && part.fecha_termino ? Math.max(1, businessDays(start, day(part.fecha_termino))) : Math.max(1, Math.ceil(Number(part.cantidad_presupuestada || 0) / Math.max(1, Number(part.rendimiento_meta || 1))));
      const planned = start && start <= cutoff ? Math.min(100, (Math.max(0, businessDays(start, cutoff)) / duration) * 100) : 0;
      const scheduleDays = Math.round(((actual.pct - planned) / 100) * duration);
      return { ...part, ...actual, planned, scheduleDays, duration };
    });
    const progress = detail.length ? detail.reduce((sum: number, item: Row) => sum + item.pct, 0) / detail.length : 0;
    const planned = detail.length ? detail.reduce((sum: number, item: Row) => sum + item.planned, 0) / detail.length : 0;
    const start = day(data.work?.fecha_inicio_real) || detail.map((p: Row) => day(p.fecha_inicio)).filter(Boolean).sort()[0] || '';
    const finish = day(data.work?.fecha_termino_estimada) || detail.map((p: Row) => day(p.fecha_termino)).filter(Boolean).sort().at(-1) || '';
    const totalDays = start && finish ? Math.max(1, businessDays(start, finish)) : 0;
    const scheduleDays = totalDays ? Math.round(((progress - planned) / 100) * totalDays) : null;
    const projectedFinish = finish && scheduleDays !== null ? shiftBusinessDays(finish, -scheduleDays) : '';
    const latest = data.attendance.map((item: Row) => day(item.fecha_marcacion || item.created_at)).filter(Boolean).sort().at(-1);
    const present = new Set(data.attendance.filter((item: Row) => day(item.fecha_marcacion || item.created_at) === latest && String(item.asistencia).toLowerCase().includes('pres')).map((item: Row) => item.rut || item.trabajador));
    const recentReports = data.adv.filter((a: Row) => businessDays(day(a.created_at), cutoff) >= 0 && businessDays(day(a.created_at), cutoff) <= 7).length;
    return { detail, progress, planned, scheduleDays, projectedFinish, contractualFinish: finish, delayed: detail.filter((p: Row) => p.scheduleDays < 0).length, completed: detail.filter((p: Row) => p.pct >= 100).length, noProgress: detail.filter((p: Row) => p.planned > 0 && p.pct === 0).length, recentReports, present: present.size, total: data.workers.length, latest };
  }, [data]);
  const upcoming = useMemo(() => data.equip.flatMap((item: Row) => (Array.isArray(item.planes_mantencion) ? item.planes_mantencion : []).map((plan: Row) => ({ item, plan, remaining: Number(plan.intervalo || 0) - (Number(item.horometro_inicial || 0) - Number(plan.ultima_lectura || 0)) }))).sort((a: Row, b: Row) => a.remaining - b.remaining), [data.equip]);
  const progressByPart = useMemo(() => metrics.detail.slice().sort((a: Row, b: Row) => a.scheduleDays - b.scheduleDays).slice(0, 10).map((part: Row) => ({ label: part.partida, value: part.pct, display: `${part.pct.toFixed(1)}% · ${part.scheduleDays === 0 ? 'en plazo' : `${Math.abs(part.scheduleDays)} d ${part.scheduleDays > 0 ? 'ganados' : 'perdidos'}`}`, color: part.scheduleDays < 0 ? colors.orange : part.pct >= 100 ? colors.green : colors.blue })), [metrics.detail]);

  return <Screen refreshing={loading} onRefresh={load}>
    <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={20} /><Text style={s.backText}>Volver a obras</Text></Pressable>
    <Header title={nombre || 'Obra'} subtitle="Vista operativa en terreno" icon="business-outline" />
    <Segments value={tab} options={tabs} onChange={setTab} />
    {(tab === 'avance' || tab === 'asistencia') && <WorkEntryActions mode={tab === 'avance' ? 'progress' : 'attendance'} profile={profile!} workId={Number(id)} workName={nombre || ''} parts={data.parts} onSaved={load} />}
    <ErrorBox text={error} />
    {loading && !data.parts.length ? <Loading /> : <>
      {tab === 'avance' && (metrics.detail.length ? metrics.detail.map((part: Row) => <Card key={part.id}><Text style={s.name}>{part.partida}</Text><Text style={s.meta}>{part.done.toLocaleString('es-CL')} de {Number(part.cantidad_presupuestada || 0).toLocaleString('es-CL')} {part.unidad}</Text><Progress value={part.pct} /></Card>) : <Empty text="La obra aún no tiene partidas cargadas." />)}
      {tab === 'equipos' && <><View style={s.actions}><MachineryActions mode="usage" equipment={data.equip} profile={profile!} onSaved={load} /><MachineryActions mode="failure" equipment={data.equip} profile={profile!} onSaved={load} /></View>{data.equip.length ? data.equip.map((item: Row) => <Card key={item.id}><Text style={s.name}>{item.tipo} · {item.patente || 'S/P'}</Text><Text style={s.meta}>{item.marca || 'Sin marca'} · Lectura {Number(item.horometro_inicial || 0).toLocaleString('es-CL')}</Text></Card>) : <Empty text="No hay equipos asignados a esta obra." />}<Text style={s.section}>Próximas mantenciones</Text>{upcoming.length ? upcoming.slice(0, 8).map((entry: Row, index: number) => <Card key={`${entry.item.id}-${index}`}><Badge tone={entry.remaining <= 0 ? 'red' : entry.remaining <= 10 ? 'amber' : 'green'}>{entry.remaining <= 0 ? 'Vencida' : 'Próxima'}</Badge><Text style={s.name}>{entry.item.tipo} · {entry.item.patente}</Text><Text style={s.meta}>{entry.plan.nombre || 'Mantención'} · {Math.max(0, entry.remaining)} {entry.plan.unidad || 'horas'} restantes</Text></Card>) : <Empty text="No hay planes de mantención configurados." />}</>}
      {tab === 'asistencia' && <Card><Text style={s.metric}>{metrics.present} de {metrics.total}</Text><Text style={s.meta}>presentes en la última jornada registrada {metrics.latest || ''}</Text></Card>}
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
const s = StyleSheet.create({ back: { flexDirection: 'row', alignItems: 'center', gap: 7 }, backText: { fontSize: 12, fontWeight: '800', color: colors.ink }, actions: { flexDirection: 'row', gap: 8 }, section: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', color: colors.ink }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 }, name: { fontSize: 14, fontWeight: '900', color: colors.ink }, meta: { fontSize: 11, color: colors.muted }, metric: { fontSize: 28, fontWeight: '900', color: colors.green }, warning: { color: colors.orange }, metricSmall: { fontSize: 24, fontWeight: '900', color: colors.blue }, label: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', color: colors.muted }, stats: { flexDirection: 'row', gap: 10 } });
