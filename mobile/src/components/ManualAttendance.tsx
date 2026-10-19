import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { buildManualAttendanceBatch, attendanceWorkerKey } from '@/lib/attendanceBatch';
import { calculateScheduledAttendance, scheduleForDate, scheduledDayHours } from '@/lib/weeklyWorkSchedule';

import type { Profile } from '@/lib/types';

type Row = Record<string, any>;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const states = [['PRESENTE', 'Presente'], ['AUSENTE', 'Ausente'], ['LICENCIA', 'Licencia médica'], ['VACACIONES', 'Vacaciones']];

export function ManualAttendance({ profile, workId, workName, work, onSaved }: { profile: Profile; workId: number; workName: string; work: Row | null; onSaved: () => void }) {
  const {colors}=useTheme();
  const s=useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false), [workers, setWorkers] = useState<Row[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(today), [search, setSearch] = useState(''), [status, setStatus] = useState('PRESENTE');
  const [entry, setEntry] = useState('08:00'), [exit, setExit] = useState('18:00'), [meal, setMeal] = useState(true);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const day = scheduleForDate(work, date);
  const ordinaryHours = day ? scheduledDayHours(day) : Number(work?.jornada_ordinaria_horas ?? 9);
  const attendance = { asistencia: status, ingreso: entry, salida: exit, colacion: meal ? 'SI' : 'NO' };
  let hours: { worked: number; ordinary: number; extra: number } | null = null;
  let hoursError = '';
  try { hours = calculateScheduledAttendance(attendance, day, ordinaryHours); } catch (e) { hoursError = e instanceof Error ? e.message : 'Revisa los horarios.'; }
  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      try {
        const all: Row[] = [];
        for (let offset = 0; ; offset += 1000) {
          const result = await supabase.from('maestro_personal').select('id,nombre,rut,cargo,empresa').eq('empresa', profile.empresa).eq('obra_nombre', workName).order('id').range(offset, offset + 999);
          if (result.error) throw result.error;
          all.push(...(result.data || [])); if ((result.data || []).length < 1000) break;
        }
        if (active) { setWorkers(all); setSelected([]); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'No fue posible cargar el personal.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [open, profile.empresa, workName]);
  const visible = useMemo(() => workers.filter(w => `${w.nombre} ${w.rut} ${w.cargo || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [workers, search]);
  const toggle = (key: string) => setSelected(previous => previous.includes(key) ? previous.filter(k => k !== key) : previous.length < 200 ? [...previous, key] : previous);
  const changeDate = (value: string) => {
    setDate(value);
    if (validDate(value)) {
      const schedule = scheduleForDate(work, value);
      if (schedule?.active) { setEntry(schedule.start); setExit(schedule.end); setMeal(!!(schedule.breakStart && schedule.breakEnd)); }
    }
  };
  const save = async () => {
    if (saving) return;
    if (!validDate(date)) return Alert.alert('Fecha inválida', 'Utiliza una fecha válida en formato AAAA-MM-DD.');
    if (!selected.length) return Alert.alert('Falta la selección', 'Selecciona al menos un trabajador.');
    if (hoursError || (status === 'PRESENTE' && (!entry || !exit || entry === exit))) return Alert.alert('Revisa el horario', hoursError || 'Indica horas de entrada y salida diferentes.');
    setSaving(true); setError('');
    try {
      const chosen = workers.filter(w => selected.includes(attendanceWorkerKey(w)));
      if (chosen.length !== selected.length) throw new Error('Cambió la lista de trabajadores. Revisa la selección.');
      const base = { empresa: profile.empresa, obra_id: workId, obra_nombre: workName, supervisor: profile.usuario,
        fecha_marcacion: date, asistencia: status, ingreso: status === 'PRESENTE' ? entry : null, salida: status === 'PRESENTE' ? exit : null,
        colacion: status === 'PRESENTE' ? attendance.colacion : null, jornada_ordinaria_horas: ordinaryHours, jornada_aplicada: day,
        horas_ordinarias: hours!.ordinary, horas_extras_auto: hours!.extra };
      buildManualAttendanceBatch(base, chosen);
      const existing: Row[] = [];
      for (let offset = 0; ; offset += 1000) {
        const result = await supabase.from('asistencia_personal').select('rut,rut_normalizado,trabajador').eq('empresa', profile.empresa).eq('obra_id', workId).eq('fecha_marcacion', date).order('id').range(offset, offset + 999);
        if (result.error) throw result.error;
        existing.push(...(result.data || [])); if ((result.data || []).length < 1000) break;
      }
      const batch = buildManualAttendanceBatch(base, chosen, existing);
      const result = await supabase.from('asistencia_personal').insert(batch).select('id');
      if (result.error) throw result.error;
      if (result.data?.length !== batch.length) throw new Error('No se confirmó el guardado completo. Actualiza la asistencia antes de reintentar.');
      setOpen(false); setSelected([]); onSaved();
      Alert.alert('Asistencia guardada', `Se registraron ${batch.length} trabajadores para el ${date.split('-').reverse().join('/')}.`);
    } catch (e) { setError(e instanceof Error ? e.message : String((e as Row)?.message || 'No fue posible guardar. Revisa la conexión y vuelve a intentar.')); }
    finally { setSaving(false); }
  };
  const allVisible = visible.length > 0 && visible.every(w => selected.includes(attendanceWorkerKey(w)));
  return <>
    <Pressable onPress={() => { setLoading(true); setError(''); setSelected([]); changeDate(today()); setOpen(true); }} style={s.open}><Ionicons name="people" size={20} color={colors.onPrimary} /><Text style={s.white}>Registrar asistencia manual</Text></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => { if (!saving) setOpen(false); }}>
      <View style={s.overlay}><View style={[s.sheet, { paddingBottom: Math.max(20, insets.bottom) }]}>
        <View style={s.row}><Text style={s.title}>Asistencia manual</Text><Pressable disabled={saving} onPress={() => setOpen(false)} accessibilityLabel="Cerrar"><Ionicons color={colors.ink} name="close" size={26} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <Text style={s.help}>{workName} · El estado y horario se aplican a todos los seleccionados.</Text>
          <Text style={s.label}>Fecha</Text><TextInput placeholderTextColor={colors.muted} selectionColor={colors.blue} editable={!saving} value={date} onChangeText={changeDate} placeholder="AAAA-MM-DD" style={s.input} maxLength={10} />
          <Text style={s.label}>Trabajadores · {selected.length} seleccionados (máximo 200)</Text>
          <TextInput placeholderTextColor={colors.muted} selectionColor={colors.blue} editable={!saving} value={search} onChangeText={setSearch} placeholder="Buscar por nombre, RUT o cargo" style={s.input} />
          <Pressable disabled={saving || loading} onPress={() => setSelected(previous => allVisible ? previous.filter(k => !visible.some(w => attendanceWorkerKey(w) === k)) : [...new Set([...previous, ...visible.map(attendanceWorkerKey)])].slice(0, 200))}><Text style={s.link}>{allVisible ? 'Desmarcar visibles' : 'Seleccionar visibles'}</Text></Pressable>
          {loading && <Text style={{color:colors.ink}}>Cargando personal…</Text>}
          {visible.map(w => { const checked = selected.includes(attendanceWorkerKey(w)); return <Pressable key={attendanceWorkerKey(w)} disabled={saving} accessibilityRole="checkbox" accessibilityState={{ checked }} aria-checked={checked} onPress={() => toggle(attendanceWorkerKey(w))} style={[s.worker, checked && s.active]}><Ionicons name={checked ? 'checkbox' : 'square-outline'} size={23} color={checked ? colors.blue : colors.muted} /><View style={s.flex}><Text style={s.workerName}>{w.nombre}</Text><Text style={s.help}>{w.rut || 'Sin RUT'} · {w.cargo || 'Personal'}</Text></View></Pressable>; })}
          {!loading && !visible.length && <Text style={s.help}>No hay trabajadores que coincidan con la búsqueda.</Text>}
          <Text style={s.label}>Estado de asistencia</Text><View style={s.choices}>{states.map(([key, label]) => <Pressable key={key} disabled={saving} onPress={() => setStatus(key)} style={[s.choice, status === key && s.active]}><Text style={{color:status===key?colors.blue:colors.muted,fontWeight:status===key?'600':'400'}}>{label}</Text></Pressable>)}</View>
          {status === 'PRESENTE' && <><View style={s.row}><View style={s.flex}><Text style={s.label}>Hora de entrada</Text><TextInput placeholderTextColor={colors.muted} selectionColor={colors.blue} editable={!saving} value={entry} onChangeText={setEntry} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} style={s.input} /></View><View style={s.flex}><Text style={s.label}>Hora de salida</Text><TextInput placeholderTextColor={colors.muted} selectionColor={colors.blue} editable={!saving} value={exit} onChangeText={setExit} placeholder="18:00" keyboardType="numbers-and-punctuation" maxLength={5} style={s.input} /></View></View>
          <View style={s.row}><Text style={s.flex}>Descontar colación</Text><Switch disabled={saving} value={meal} onValueChange={setMeal} /></View>
          <Text style={s.help}>Jornada de la obra: {ordinaryHours} h ordinarias{day && !day.active ? ' · Día no laborable' : ''}.</Text>
          {hours && <Text style={s.hours}>{hours.worked} h trabajadas · {hours.ordinary} h ordinarias · {hours.extra} h extras</Text>}
          {!!hoursError && <Text style={s.error}>{hoursError}</Text>}</>}
          {!!error && <Text style={s.error}>{error}</Text>}
          <Text style={s.help}>Necesitas conexión para comprobar y guardar los marcajes.</Text>
        </ScrollView>
        <Pressable disabled={saving || loading || !selected.length || !!hoursError} onPress={() => void save()} style={[s.save, (saving || loading || !selected.length || !!hoursError) && s.disabled]}><Text style={s.white}>{saving ? 'Guardando…' : `Registrar ${selected.length} trabajador${selected.length === 1 ? '' : 'es'}`}</Text></Pressable>
      </View></View>
    </Modal>
  </>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({ open: { minHeight: 48, borderRadius: 14, backgroundColor:colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 10 }, white: { color:colors.onPrimary, fontWeight:'700' }, overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', backgroundColor:colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, gap: 12 }, content: { gap: 10, paddingBottom: 16 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' }, flex: { flex: 1 }, title: { fontSize: 21, fontWeight:'700', color: colors.ink }, label: { fontSize:13, fontWeight:'600', color: colors.muted, marginTop: 5 }, input: { borderWidth: 1, borderColor: colors.line, borderRadius: 13, padding: 13, fontSize: 15, color: colors.ink }, worker: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }, active: { backgroundColor: colors.blueSoft, borderColor: colors.blue }, workerName: { fontSize: 13, fontWeight:'600', color: colors.ink }, help: { fontSize: 12, color: colors.muted }, link: { fontSize: 13, fontWeight:'600', color: colors.blue, paddingVertical: 8 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { padding: 11, borderWidth: 1, borderColor: colors.line, borderRadius: 12 }, hours: { fontSize: 13, color: colors.blue, fontWeight:'600' }, error: { color: colors.red, fontSize: 13 }, save: { height: 52, borderRadius: 14, backgroundColor:colors.primary, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: .45 } });
