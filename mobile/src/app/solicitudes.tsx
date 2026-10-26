import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Badge, Card, Empty, ErrorBox, Header, Loading, Screen, SearchField, Segments } from '@/components/ui';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/lib/theme';

const categories = ['Carga de combustible', 'Traslado de equipos', 'Materiales', 'Insumos de bodega', 'Elementos de protección personal'];
const transitions: Record<string, string[]> = { Pendiente: ['En revisión', 'Aprobada', 'Rechazada'], 'En revisión': ['Aprobada', 'Rechazada'], Aprobada: ['Completada'] };
type Person = { id: number; nombre: string; cargo?: string };
type Department = { id: string; nombre: string; responsable_id: number; activo: boolean };
type Request = { id: string; titulo: string; categoria: string; descripcion: string; referencia?: string; fecha_requerida?: string; solicitante_id: number; destinatario_id: number; solicitante_nombre?: string; destinatario_nombre?: string; departamento_nombre?: string; estado: string; version: number; updated_at: string };
type Detail = { solicitud: Request; eventos: { id: string; actor_nombre: string; mensaje: string; estado: string; created_at: string }[] };
const blank = () => ({ id: Crypto.randomUUID(), titulo: '', categoria: categories[0], descripcion: '', referencia: '', fecha_requerida: '', destinatario_id: '', departamento_id: '' });

export default function RequestsScreen() {
  const { id: initialId } = useLocalSearchParams<{ id?: string }>();
  const { profile, loading: authLoading } = useAuth();
  const { colors } = useTheme(), s = useThemedStyles(styles);
  const [options, setOptions] = useState<{ usuarios: Person[]; departamentos: Department[] }>({ usuarios: [], departamentos: [] });
  const [items, setItems] = useState<Request[]>([]), [box, setBox] = useState('enviadas'), [history, setHistory] = useState('activas'), [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null), [create, setCreate] = useState(false), [form, setForm] = useState(blank), [query, setQuery] = useState('');
  const [message, setMessage] = useState(''), [state, setState] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const locked = useRef(false), generation = useRef(0), operation = useRef<{ signature: string; id: string } | null>(null);
  const api = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    if (!profile) throw new Error('Inicia sesión para continuar');
    const result = await supabase.rpc('solicitudes_api', { p_perfil: Number(profile.id), p_accion: action, p_datos: data });
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }, [profile?.id]);
  const load = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError('');
    try { const [o, rows] = await Promise.all([api('opciones'), api('listar', { bandeja: box, historial: history === 'historial', offset: page * 50 })]); if (current === generation.current) { setOptions(o); setItems(rows); } }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'No fue posible cargar las solicitudes'); }
    finally { if (current === generation.current) setLoading(false); }
  }, [api, box, history, page]);
  useEffect(() => { if (profile?.id) void load(); return () => { generation.current++; }; }, [load, profile?.id]);
  useEffect(() => { setDetail(null); setCreate(false); setForm(blank()); setItems([]); }, [profile?.id]);
  useEffect(() => { if (!initialId || !profile?.id) return; let active = true; api('detalle', { id: initialId }).then(data => { if (active) setDetail(data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [api, initialId, profile?.id]);
  const run = async (work: () => Promise<void>) => { if (locked.current) return; locked.current = true; setBusy(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible guardar. Puedes reintentar.'); } finally { locked.current = false; setBusy(false); } };
  const open = (id: string) => run(async () => { setDetail(await api('detalle', { id })); setMessage(''); setState(''); operation.current = null; setCreate(false); });
  const change = (key: keyof ReturnType<typeof blank>, value: string) => setForm(old => ({ ...old, [key]: value }));
  const send = () => run(async () => {
    if (form.titulo.trim().length < 3 || form.descripcion.trim().length < 3) throw new Error('Completa el asunto y el detalle de la solicitud.');
    if (!form.destinatario_id && !form.departamento_id) throw new Error('Selecciona un destinatario o departamento.');
    if (form.fecha_requerida && !/^\d{4}-\d{2}-\d{2}$/.test(form.fecha_requerida)) throw new Error('La fecha debe tener formato AAAA-MM-DD.');
    const result = await api('crear', form); setDetail(await api('detalle', { id: result.id })); setForm(blank()); setCreate(false); await load();
  });
  const respond = () => run(async () => {
    if (!detail) return;
    const payload = { id: detail.solicitud.id, version: detail.solicitud.version, mensaje: message, estado: state || detail.solicitud.estado };
    const signature = JSON.stringify(payload);
    if (operation.current?.signature !== signature) operation.current = { signature, id: Crypto.randomUUID() };
    await api('responder', { ...payload, evento_id: operation.current.id }); setDetail(await api('detalle', { id: detail.solicitud.id })); setMessage(''); setState(''); operation.current = null; await load();
  });
  const name = (id: number) => id === Number(profile?.id) ? (profile?.nombre || profile?.usuario) : options.usuarios.find(p => p.id === id)?.nombre || 'Usuario';
  if (authLoading) return <Screen><Loading/></Screen>;
  if (!profile) return <Redirect href="/login"/>;
  const request = detail?.solicitud;
  const action = (label: string, onPress: () => void, primary = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={[s.button, primary && s.primary, busy && { opacity: 0.5 }]}><Text style={[s.buttonText, primary && { color: colors.onPrimary }]}>{label}</Text></Pressable>;
  const textField = (label: string, key: keyof ReturnType<typeof blank>, multiline = false) => <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} value={form[key]} onChangeText={value => change(key, value)} multiline={multiline} maxLength={key === 'descripcion' ? 10000 : key === 'titulo' ? 160 : key === 'fecha_requerida' ? 10 : 200} placeholderTextColor={colors.muted} style={[s.input, multiline && s.textarea]}/></View>;
  return <Screen refreshing={loading} onRefresh={() => { if (request) void open(request.id); else void load(); }}>
    {action('← Volver', () => { if (create || detail) { setCreate(false); setDetail(null); } else router.back(); })}
    <Header title="Mis solicitudes" subtitle="Recursos, respuestas y seguimiento personal." icon="paper-plane-outline"/>
    <ErrorBox text={error}/>
    {create ? <Card><Text style={s.title}>Nueva solicitud</Text><Text style={s.label}>Categoría</Text><Segments value={form.categoria} options={categories.map(c => ({ key: c, label: c }))} onChange={value => change('categoria', value)}/>
      <Text style={s.label}>Enviar a</Text><Segments value={form.departamento_id || 'persona'} options={[{ key: 'persona', label: 'Una persona' }, ...options.departamentos.filter(d => d.activo && d.responsable_id !== Number(profile.id)).map(d => ({ key: d.id, label: `${d.nombre} · ${name(d.responsable_id)}` }))]} onChange={value => { change('departamento_id', value === 'persona' ? '' : value); change('destinatario_id', ''); }}/>
      {!form.departamento_id && <><SearchField value={query} onChangeText={setQuery} placeholder="Buscar destinatario por nombre o cargo"/><Text style={s.meta}>{form.destinatario_id ? `Seleccionado: ${name(Number(form.destinatario_id))}` : 'Selecciona un destinatario'}</Text><View style={s.people}>{options.usuarios.filter(p => `${p.nombre} ${p.cargo || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(p => <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: form.destinatario_id === String(p.id) }} style={[s.person, form.destinatario_id === String(p.id) && s.selected]} onPress={() => change('destinatario_id', String(p.id))}><Text style={s.label}>{p.nombre}</Text><Text style={s.meta}>{p.cargo}</Text></Pressable>)}</View></>}
      {textField('Asunto', 'titulo')}{textField('Detalle: cantidades, unidades, lugar y condiciones', 'descripcion', true)}{textField('Obra / centro / referencia (opcional)', 'referencia')}{textField('Fecha requerida (AAAA-MM-DD, opcional)', 'fecha_requerida')}
      <Text style={s.meta}>Aprobar no registra gastos ni entregas automáticamente.</Text>{action(busy ? 'Enviando…' : 'Enviar solicitud', () => void send(), true)}</Card>
      : request ? <><Card><Badge>{request.estado}</Badge><Text style={s.title}>{request.titulo}</Text><Text style={s.meta}>{request.categoria}</Text><Text style={s.text}>De: {name(request.solicitante_id)}{ '\n' }Para: {name(request.destinatario_id)}{request.departamento_nombre ? ` · ${request.departamento_nombre}` : ''}</Text><Text style={s.text}>{request.descripcion}</Text><Text style={s.meta}>Referencia: {request.referencia || 'No indicada'}{ '\n' }Fecha requerida: {request.fecha_requerida || 'No indicada'}</Text></Card><Text style={s.title}>Seguimiento</Text>{detail?.eventos.map(e => <Card key={e.id}><Text style={s.label}>{e.actor_nombre}</Text><Text style={s.meta}>{new Date(e.created_at).toLocaleString('es-CL')} · {e.estado}</Text><Text style={s.text}>{e.mensaje}</Text></Card>)}{!['Rechazada', 'Completada'].includes(request.estado) && <Card><Text style={s.label}>Respuesta / motivo del rechazo</Text><TextInput accessibilityLabel="Respuesta" multiline maxLength={10000} style={[s.input, s.textarea]} value={message} onChangeText={setMessage}/>{request.destinatario_id === Number(profile.id) && <Segments value={state} options={[{ key: '', label: 'Solo responder' }, ...(transitions[request.estado] || []).map(value => ({ key: value, label: value }))]} onChange={setState}/>}<Text style={s.meta}>Aprobada continúa activa hasta confirmar que está completada.</Text>{action(busy ? 'Guardando…' : 'Guardar respuesta', () => void respond(), true)}</Card>}</>
      : <>{action('＋ Nueva solicitud', () => { setCreate(true); setError(''); }, true)}<Segments value={box} options={[{ key: 'enviadas', label: 'Mis solicitudes' }, { key: 'recibidas', label: 'Recibidas' }]} onChange={v => { setBox(v); setPage(0); }}/><Segments value={history} options={[{ key: 'activas', label: 'Activas' }, { key: 'historial', label: 'Historial' }]} onChange={v => { setHistory(v); setPage(0); }}/>{loading ? <Loading/> : items.length ? items.slice(0, 50).map(item => <Card key={item.id} onPress={() => void open(item.id)}><Badge>{item.estado}</Badge><Text style={s.title}>{item.titulo}</Text><Text style={s.meta}>{item.categoria}</Text><Text style={s.text}>{box === 'recibidas' ? `De: ${item.solicitante_nombre}` : `Para: ${item.destinatario_nombre}`}</Text><Text style={s.meta}>{new Date(item.updated_at).toLocaleString('es-CL')}</Text></Card>) : <Empty text="No hay solicitudes en esta bandeja."/>}<View style={s.row}>{page > 0 && action('Anterior', () => setPage(p => p - 1))}{items.length > 50 && action('Siguiente', () => setPage(p => p + 1))}</View></>}
  </Screen>;
}
const styles = (c: ThemeColors) => StyleSheet.create({ button: { padding: 14, minHeight: 48, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', borderWidth: 1, borderColor: c.line }, primary: { backgroundColor: c.blue, borderColor: c.blue }, buttonText: { color: c.blue, fontWeight: '700' }, title: { fontSize: 18, fontWeight: '700', color: c.ink }, label: { fontSize: 14, fontWeight: '600', color: c.ink }, text: { fontSize: 14, lineHeight: 21, color: c.ink }, meta: { fontSize: 12, color: c.muted, lineHeight: 18 }, input: { borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12, color: c.ink, backgroundColor: c.surface, minHeight: 48 }, textarea: { minHeight: 110, textAlignVertical: 'top' }, field: { gap: 7 }, row: { flexDirection: 'row', gap: 12 }, people: { gap: 6 }, person: { borderWidth: 1, borderColor: c.line, padding: 12, borderRadius: 12 }, selected: { borderColor: c.blue, backgroundColor: c.blueSoft } });
