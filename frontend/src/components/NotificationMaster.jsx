import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  BarChart3, Bell, CalendarClock, CheckCircle2, ChevronDown, Clock3, Edit3, Mail,
  Plus, Search, Send, Settings2, Trash2, Users, X, Zap
} from 'lucide-react';
import ExecutiveReportScheduler from './ExecutiveReportScheduler';

const CATALOG = [
  { code: 'avance_registrado', module: 'Obras', name: 'Avance registrado', description: 'Informa cada nuevo reporte de avance físico.', frequency: 'Inmediata' },
  { code: 'avance_reporte_pendiente', module: 'Obras', name: 'Reporte de avance diario pendiente', description: 'Avisa las obras activas que no han enviado su reporte diario. Un reporte con avance 0 se considera correctamente informado.', frequency: 'Diaria' },
  { code: 'reportes_diarios_pendientes', module: 'Obras', name: 'Resumen diario de informes pendientes', description: 'Consolida cada día las obras que aún deben informar avance o uso de maquinaria.', frequency: 'Diaria' },
  { code: 'resumen_diario_obra', module: 'Obras', name: 'Resumen diario de obra', description: 'Consolida avances, asistencia, incidencias y pendientes del día.', frequency: 'Diaria' },
  { code: 'desviacion_programacion', module: 'Obras', name: 'Desviación de programación', description: 'Alerta cuando el avance real queda bajo el plan.', frequency: 'Diaria' },
  { code: 'partida_proxima_inicio', module: 'Obras', name: 'Partida próxima a iniciar', description: 'Anticipa partidas y recursos que deben quedar liberados.', frequency: 'Anticipada' },
  { code: 'restriccion_last_planner', module: 'Obras', name: 'Restricción Last Planner pendiente', description: 'Alerta compromisos que podrían impedir el inicio de una partida.', frequency: 'Diaria' },
  { code: 'mantenimiento_proximo', module: 'Maquinaria', name: 'Próximo mantenimiento', description: 'Avisa antes de alcanzar la fecha, horómetro o kilometraje de mantención.', frequency: 'Anticipada' },
  { code: 'maquinaria_reporte_pendiente', module: 'Maquinaria', name: 'Reporte diario de maquinaria pendiente', description: 'Avisa cuando una obra con equipos asignados no ha registrado su reporte diario de uso, incluso si el equipo no trabajó.', frequency: 'Diaria' },
  { code: 'mantenimiento_vencido', module: 'Maquinaria', name: 'Mantenimiento vencido', description: 'Escala equipos con mantenimiento pendiente.', frequency: 'Diaria' },
  { code: 'maquinaria_falla_reportada', module: 'Maquinaria', name: 'Falla de equipo reportada', description: 'Informa fallas, detenciones y horas fuera de servicio.', frequency: 'Inmediata' },
  { code: 'maquinaria_reserva_conflicto', module: 'Maquinaria', name: 'Conflicto o vencimiento de reserva', description: 'Advierte conflictos de disponibilidad y reservas próximas.', frequency: 'Anticipada' },
  { code: 'incidente_accidente', module: 'Prevención', name: 'Incidente o accidente informado', description: 'Notificación inmediata de un evento preventivo.', frequency: 'Inmediata' },
  { code: 'prevencion_accion_vencida', module: 'Prevención', name: 'Acción preventiva vencida', description: 'Escala medidas correctivas sin cierre dentro del plazo.', frequency: 'Diaria' },
  { code: 'prevencion_registro_recibido', module: 'Prevención', name: 'Nuevo registro preventivo', description: 'Informa inspecciones, PARE, AST y registros recibidos.', frequency: 'Inmediata' },
  { code: 'prevencion_cumplimiento_pendiente', module: 'Prevención', name: 'Cumplimiento preventivo pendiente', description: 'Avisa al usuario responsable y escala a los destinatarios configurados cuando un formulario diario, semanal o mensual no fue completado al vencimiento.', frequency: 'Diaria' },
  { code: 'prevencion_cumplimiento_bajo', module: 'Prevención', name: 'Cumplimiento preventivo bajo meta', description: 'Alerta cuando una obra o actividad cae bajo el estándar configurado.', frequency: 'Semanal' },
  { code: 'rdi_pendiente', module: 'Calidad', name: 'RDI pendiente de respuesta', description: 'Recuerda solicitudes RDI sin respuesta dentro del plazo.', frequency: 'Diaria' },
  { code: 'recepcion_observada', module: 'Calidad', name: 'Recepción observada o rechazada', description: 'Informa observaciones y rechazos de partidas.', frequency: 'Inmediata' },
  { code: 'calidad_nc_vencida', module: 'Calidad', name: 'No conformidad vencida', description: 'Escala no conformidades que no han sido cerradas.', frequency: 'Diaria' },
  { code: 'calidad_recepcion_solicitada', module: 'Calidad', name: 'Recepción de partida solicitada', description: 'Avisa que existe un protocolo pendiente de revisión.', frequency: 'Inmediata' },
  { code: 'estado_pago_cambio', module: 'Estados de pago', name: 'Cambio de estado de pago', description: 'Informa envíos, observaciones, aprobaciones y pagos.', frequency: 'Inmediata' },
  { code: 'estado_pago_documentos_pendientes', module: 'Estados de pago', name: 'Documentación contractual pendiente', description: 'Recuerda documentos obligatorios pendientes o rechazados.', frequency: 'Diaria' },
  { code: 'estado_pago_factura_pendiente', module: 'Estados de pago', name: 'Factura pendiente de emisión o pago', description: 'Da seguimiento a la factura asociada al estado de pago.', frequency: 'Anticipada' },
  { code: 'ep_subcontrato_documentos_pendientes', module: 'Subcontratos', name: 'Documentos pendientes del estado de pago', description: 'Avisa que el expediente obligatorio está incompleto o pendiente de revisión.', frequency: 'Diaria' },
  { code: 'ep_subcontrato_documento_observado', module: 'Subcontratos', name: 'Documento observado o rechazado', description: 'Informa al responsable cuando un antecedente debe corregirse.', frequency: 'Inmediata' },
  { code: 'ep_subcontrato_expediente_aprobado', module: 'Subcontratos', name: 'Expediente documental aprobado', description: 'Informa que el estado de pago ya puede continuar a aprobación y facturación.', frequency: 'Inmediata' },
  { code: 'factura_vencimiento', module: 'Facturación', name: 'Factura próxima a vencer', description: 'Avisa documentos por vencer o vencidos.', frequency: 'Anticipada' },
  { code: 'acreditacion_vencimiento', module: 'Acreditaciones', name: 'Acreditación próxima a vencer', description: 'Controla documentos de empresa, personal y equipos.', frequency: 'Anticipada' },
  { code: 'stock_minimo', module: 'Bodega', name: 'Stock mínimo', description: 'Alerta cuando un artículo alcanza su nivel de reposición.', frequency: 'Inmediata' },
  { code: 'bodega_quiebre_stock', module: 'Bodega', name: 'Quiebre de stock', description: 'Alerta productos sin disponibilidad para la operación.', frequency: 'Inmediata' },
  { code: 'bodega_transferencia_pendiente', module: 'Bodega', name: 'Transferencia pendiente de recepción', description: 'Recuerda movimientos entre bodegas aún no confirmados.', frequency: 'Diaria' },
  { code: 'bodega_guia_sin_conciliar', module: 'Bodega', name: 'Guía de despacho sin conciliar', description: 'Advierte guías que no están asociadas correctamente a movimientos o DTE.', frequency: 'Diaria' },
  { code: 'rrhh_contrato_vencimiento', module: 'Recursos Humanos', name: 'Contrato próximo a vencer', description: 'Anticipa vencimientos contractuales de trabajadores.', frequency: 'Anticipada' },
  { code: 'rrhh_documento_vencimiento', module: 'Recursos Humanos', name: 'Documento laboral próximo a vencer', description: 'Controla documentos obligatorios del trabajador.', frequency: 'Anticipada' },
  { code: 'rrhh_brecha_dotacion', module: 'Recursos Humanos', name: 'Brecha de dotación proyectada', description: 'Avisa cargos requeridos que aún no tienen cobertura.', frequency: 'Semanal' },
  { code: 'rrhh_ausencia_critica', module: 'Recursos Humanos', name: 'Ausencia o dotación crítica', description: 'Alerta ausencias que afectan la dotación mínima de una obra.', frequency: 'Inmediata' },
  { code: 'gasto_pendiente', module: 'Gastos', name: 'Rendición pendiente de aprobación', description: 'Informa rendiciones que requieren revisión.', frequency: 'Diaria' },
  { code: 'gasto_observado', module: 'Gastos', name: 'Rendición observada o rechazada', description: 'Informa al responsable que debe corregir una rendición.', frequency: 'Inmediata' },
  { code: 'dte_recibido', module: 'Facturación', name: 'Nuevo DTE recibido', description: 'Informa la recepción de facturas, notas o guías electrónicas.', frequency: 'Inmediata' },
  { code: 'dte_sin_centro_gestion', module: 'Facturación', name: 'DTE sin centro de gestión', description: 'Alerta documentos que aún no pueden imputarse a una obra o centro.', frequency: 'Diaria' },
  { code: 'libro_obra_pendiente', module: 'Libro de obra', name: 'Folio pendiente de acción', description: 'Recuerda autorizaciones, respuestas y observaciones pendientes.', frequency: 'Diaria' }
];

const emptyForm = {
  template_code: 'avance_registrado', nombre: 'Avance registrado', modulo: 'Obras', descripcion: '',
  obra_nombre: '', alcance_tipo: 'todas', obras_seleccionadas: [], roles: [], usuarios: [], correos: [''], canal_email: true,
  canal_plataforma: true, frecuencia: 'Inmediata', hora_envio: '18:00', dias_anticipacion: 7,
  activa: true
};

const normalizeArray = (value) => Array.isArray(value) ? value : [];
const scopeLabel = rule => {
  const type = rule.condiciones?.alcance_tipo || (rule.obra_nombre ? 'seleccionadas' : 'todas');
  const selected = normalizeArray(rule.condiciones?.obras_seleccionadas);
  if (type === 'asignadas') return 'Obras asignadas al destinatario';
  if (type === 'seleccionadas') return selected.length > 1 ? `${selected.length} obras seleccionadas` : (selected[0] || rule.obra_nombre || 'Obra seleccionada');
  return 'Todas las obras';
};

export default function NotificationMaster({ user, obras = [], roles = [] }) {
  const [section, setSection] = useState('alertas');
  const [rules, setRules] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState({ text: '', module: 'Todos', work: 'Todas', status: 'Todas' });
  const [message, setMessage] = useState('');

  const companyRoles = useMemo(() => {
    const configured = roles.filter(r => !r.archivado && (!r.empresa || r.empresa === user.empresa)).map(r => r.nombre);
    const assigned = users.map(u => u.rol).filter(Boolean);
    return [...new Set([...configured, ...assigned])].sort();
  }, [roles, users, user.empresa]);

  const load = async () => {
    setLoading(true);
    const [ruleResult, deliveryResult, userResult] = await Promise.all([
      supabase.from('notificaciones_reglas').select('*').eq('empresa', user.empresa).order('created_at', { ascending: false }),
      supabase.from('notificaciones_entregas').select('*').eq('empresa', user.empresa).order('created_at', { ascending: false }).limit(60),
      supabase.from('usuarios').select('id,nombre,correo,rol,empresa').eq('empresa', user.empresa).order('nombre')
    ]);
    const missing = ruleResult.error && /notificaciones_reglas|schema cache|does not exist/i.test(ruleResult.error.message || '');
    setSchemaMissing(Boolean(missing));
    if (ruleResult.error && !missing) {
      setMessage(/permission denied|row-level security/i.test(ruleResult.error.message || '')
        ? 'El Control de notificaciones está protegido por empresa. Para administrarlo debes iniciar sesión mediante Supabase Auth; la sesión heredada no puede acceder a estas reglas seguras.'
        : ruleResult.error.message);
    }
    if (!ruleResult.error) setRules(ruleResult.data || []);
    if (!deliveryResult.error) setDeliveries(deliveryResult.data || []);
    if (!userResult.error) setUsers(userResult.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user.empresa]);

  const selectTemplate = (code) => {
    const item = CATALOG.find(t => t.code === code) || CATALOG[0];
    setForm(prev => ({ ...prev, template_code: item.code, nombre: item.name, modulo: item.module, descripcion: item.description, frecuencia: item.frequency }));
  };

  const openNew = () => {
    const first = CATALOG[0];
    setEditingId(null);
    setForm({ ...emptyForm, descripcion: first.description });
    setMessage('');
    setModal(true);
  };

  const openEdit = (rule) => {
    const scope = rule.condiciones?.alcance_tipo || (rule.obra_nombre ? 'seleccionadas' : 'todas');
    const selectedWorks = normalizeArray(rule.condiciones?.obras_seleccionadas).length ? rule.condiciones.obras_seleccionadas : (rule.obra_nombre ? [rule.obra_nombre] : []);
    setEditingId(rule.id);
    setForm({
      template_code: rule.evento_codigo, nombre: rule.nombre, modulo: rule.modulo, descripcion: rule.descripcion || '',
      obra_nombre: rule.obra_nombre || '', alcance_tipo: scope, obras_seleccionadas: selectedWorks, roles: normalizeArray(rule.destinatarios_roles),
      usuarios: normalizeArray(rule.destinatarios_usuarios), correos: normalizeArray(rule.correos_adicionales).length ? rule.correos_adicionales : [''],
      canal_email: rule.canal_email, canal_plataforma: rule.canal_plataforma, frecuencia: rule.frecuencia,
      hora_envio: String(rule.hora_envio || '18:00').slice(0, 5), dias_anticipacion: rule.dias_anticipacion || 7, activa: rule.activa
    });
    setMessage('');
    setModal(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (form.alcance_tipo === 'seleccionadas' && !form.obras_seleccionadas.length) {
      setMessage('Selecciona al menos una obra para este alcance.'); return;
    }
    if (form.template_code !== 'prevencion_cumplimiento_pendiente' && !form.roles.length && !form.usuarios.length && !form.correos.some(Boolean)) {
      setMessage('Selecciona al menos un rol, usuario o correo adicional.'); return;
    }
    const payload = {
      empresa: user.empresa, nombre: form.nombre.trim(), evento_codigo: form.template_code, modulo: form.modulo,
      descripcion: form.descripcion, obra_nombre: form.alcance_tipo === 'seleccionadas' && form.obras_seleccionadas.length === 1 ? form.obras_seleccionadas[0] : null, destinatarios_roles: form.roles,
      destinatarios_usuarios: form.usuarios, correos_adicionales: form.correos.map(x => x.trim()).filter(Boolean),
      canal_email: form.canal_email, canal_plataforma: form.canal_plataforma, frecuencia: form.frecuencia,
      hora_envio: form.hora_envio || null, dias_anticipacion: form.frecuencia === 'Anticipada' ? Number(form.dias_anticipacion || 7) : null,
      condiciones: { alcance_tipo: form.alcance_tipo, obras_seleccionadas: form.alcance_tipo === 'seleccionadas' ? form.obras_seleccionadas : [] },
      activa: form.activa, creado_por: user.correo || user.usuario || null, updated_at: new Date().toISOString()
    };
    const result = editingId
      ? await supabase.from('notificaciones_reglas').update(payload).eq('id', editingId)
      : await supabase.from('notificaciones_reglas').insert(payload);
    if (result.error) { setMessage(result.error.message); return; }
    setModal(false); await load();
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar esta regla de notificación? El historial de entregas se conservará.')) return;
    const { error } = await supabase.from('notificaciones_reglas').delete().eq('id', id);
    if (error) setMessage(error.message); else load();
  };

  const toggle = async (rule) => {
    const { error } = await supabase.from('notificaciones_reglas').update({ activa: !rule.activa, updated_at: new Date().toISOString() }).eq('id', rule.id);
    if (!error) load();
  };

  const addRecommended = async () => {
    if (!window.confirm('Se crearán reglas recomendadas desactivadas para que puedas asignar sus destinatarios.')) return;
    const existing = new Set(rules.map(r => `${r.evento_codigo}|${r.obra_nombre || ''}`));
    const rows = CATALOG.filter(t => !existing.has(`${t.code}|`)).map(t => ({
      empresa: user.empresa, nombre: t.name, evento_codigo: t.code, modulo: t.module, descripcion: t.description,
      destinatarios_roles: [], destinatarios_usuarios: [], correos_adicionales: [], canal_email: true,
      canal_plataforma: true, frecuencia: t.frequency, hora_envio: '18:00', dias_anticipacion: t.frequency === 'Anticipada' ? 7 : null,
      condiciones: { alcance_tipo: 'todas', obras_seleccionadas: [] },
      activa: false, creado_por: user.correo || user.usuario || null
    }));
    if (!rows.length) return;
    const { error } = await supabase.from('notificaciones_reglas').insert(rows);
    if (error) setMessage(error.message); else load();
  };

  const filtered = rules.filter(rule => {
    const q = filter.text.toLowerCase();
    return (!q || `${rule.nombre} ${rule.modulo} ${rule.descripcion}`.toLowerCase().includes(q))
      && (filter.module === 'Todos' || rule.modulo === filter.module)
      && (filter.work === 'Todas' || (filter.work === 'Global' ? (rule.condiciones?.alcance_tipo || (!rule.obra_nombre ? 'todas' : 'seleccionadas')) === 'todas' : rule.obra_nombre === filter.work || normalizeArray(rule.condiciones?.obras_seleccionadas).includes(filter.work)))
      && (filter.status === 'Todas' || (filter.status === 'Activas' ? rule.activa : !rule.activa));
  });
  const modules = [...new Set(CATALOG.map(t => t.module))];
  const failures = deliveries.filter(d => d.estado === 'Error').length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        <button onClick={() => setSection('alertas')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${section === 'alertas' ? 'bg-slate-950 text-white' : 'text-slate-600'}`}><Bell className="h-4 w-4"/>Alertas y notificaciones</button>
        <button onClick={() => setSection('informes')} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${section === 'informes' ? 'bg-slate-950 text-white' : 'text-slate-600'}`}><BarChart3 className="h-4 w-4"/>Informes</button>
      </div>
      {section === 'informes' ? <ExecutiveReportScheduler user={user} obras={obras} roles={roles}/> : <>
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 to-blue-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-3"><div className="rounded-xl bg-white/10 p-3"><Bell className="h-6 w-6" /></div><div>
            <h3 className="text-lg font-black">Control de notificaciones</h3>
            <p className="mt-1 max-w-3xl text-xs text-slate-300">Reglas centralizadas por evento, obra y rol. Los accesos rápidos de cada módulo utilizarán esta misma configuración.</p>
          </div></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={addRecommended} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/10">Cargar recomendadas</button>
            <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black hover:bg-orange-400"><Plus className="h-4 w-4" /> Nueva regla</button>
          </div>
        </div>
      </div>

      {schemaMissing && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">Falta habilitar el Control de notificaciones en Supabase. Ejecuta <b>schema_notificaciones_master.sql</b> y actualiza.</div>}
      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{message}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [CheckCircle2, 'Reglas activas', rules.filter(r => r.activa).length, 'text-emerald-600'],
          [Zap, 'Inmediatas', rules.filter(r => r.activa && r.frecuencia === 'Inmediata').length, 'text-amber-600'],
          [CalendarClock, 'Programadas', rules.filter(r => r.activa && r.frecuencia !== 'Inmediata').length, 'text-blue-600'],
          [Bell, 'Errores recientes', failures, failures ? 'text-red-600' : 'text-slate-500']
        ].map(([Icon, label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><Icon className={`h-5 w-5 ${color}`} /><div className="mt-2 text-2xl font-black text-slate-900">{value}</div><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</div></div>)}
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4">
        <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={filter.text} onChange={e => setFilter({ ...filter, text: e.target.value })} placeholder="Buscar regla..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs" /></label>
        <select value={filter.module} onChange={e => setFilter({ ...filter, module: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option>Todos</option>{modules.map(x => <option key={x}>{x}</option>)}</select>
        <select value={filter.work} onChange={e => setFilter({ ...filter, work: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option>Todas</option><option value="Global">Todas las obras</option>{obras.map(o => <option key={o.nombre}>{o.nombre}</option>)}</select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option>Todas</option><option>Activas</option><option>Inactivas</option></select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? <div className="p-8 text-center text-xs text-slate-500">Cargando reglas...</div> : !filtered.length ? <div className="p-10 text-center"><Bell className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-600">No hay reglas configuradas</p><p className="text-xs text-slate-400">Crea una regla o carga las recomendaciones base.</p></div> :
          <div className="divide-y divide-slate-100">{filtered.map(rule => <div key={rule.id} className="grid gap-3 p-4 lg:grid-cols-[1.5fr_1fr_1fr_auto] lg:items-center">
            <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-600">{rule.modulo}</span><h4 className="text-sm font-black text-slate-900">{rule.nombre}</h4></div><p className="mt-1 text-[11px] text-slate-500">{rule.descripcion}</p></div>
            <div className="text-xs"><div className="flex items-center gap-1 font-bold text-slate-700"><Settings2 className="h-3.5 w-3.5" /> {scopeLabel(rule)}</div><div className="mt-1 text-[10px] text-slate-500">{normalizeArray(rule.destinatarios_roles).length ? normalizeArray(rule.destinatarios_roles).join(', ') : 'Sin roles asignados'}</div></div>
            <div className="text-xs"><div className="flex items-center gap-1 font-bold text-slate-700">{rule.frecuencia === 'Inmediata' ? <Zap className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}{rule.frecuencia}</div><div className="mt-1 flex gap-2 text-[10px] text-slate-500">{rule.canal_email && <span>Correo</span>}{rule.canal_plataforma && <span>Plataforma</span>}</div></div>
            <div className="flex items-center justify-end gap-1"><button onClick={() => toggle(rule)} className={`rounded-full px-3 py-1.5 text-[10px] font-black ${rule.activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{rule.activa ? 'Activa' : 'Inactiva'}</button><button onClick={() => openEdit(rule)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Edit3 className="h-4 w-4" /></button><button onClick={() => remove(rule.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>
          </div>)}</div>}
      </div>

      {modal && <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm"><form onSubmit={save} className="my-auto max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between"><div><h3 className="text-lg font-black text-slate-900">{editingId ? 'Editar regla' : 'Nueva regla de notificación'}</h3><p className="text-xs text-slate-500">Define el evento, alcance y destinatarios.</p></div><button type="button" onClick={() => setModal(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
        {message && <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">{message}</div>}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2"><span className="text-[10px] font-black uppercase text-slate-500">Evento o plantilla</span><select value={form.template_code} onChange={e => selectTemplate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs">{CATALOG.map(t => <option key={t.code} value={t.code}>{t.module} · {t.name}</option>)}</select></label>
          <label><span className="text-[10px] font-black uppercase text-slate-500">Nombre de la regla</span><input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs" /></label>
          <label><span className="text-[10px] font-black uppercase text-slate-500">Alcance de obras</span><select value={form.alcance_tipo} onChange={e => setForm({ ...form, alcance_tipo: e.target.value, obras_seleccionadas: e.target.value === 'seleccionadas' ? form.obras_seleccionadas : [] })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs"><option value="todas">Todas las obras, incluidas las futuras</option><option value="asignadas">Solo obras asignadas a cada destinatario</option><option value="seleccionadas">Una o varias obras seleccionadas</option></select></label>
          {form.alcance_tipo === 'seleccionadas' && <div className="md:col-span-2"><span className="text-[10px] font-black uppercase text-slate-500">Obras incluidas</span><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{obras.map(obra => { const checked = form.obras_seleccionadas.includes(obra.nombre); return <label key={obra.nombre} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-bold ${checked ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-600'}`}><input type="checkbox" checked={checked} onChange={() => setForm({ ...form, obras_seleccionadas: checked ? form.obras_seleccionadas.filter(name => name !== obra.nombre) : [...form.obras_seleccionadas, obra.nombre] })}/>{obra.nombre}</label>; })}</div></div>}
          <div className="md:col-span-2"><span className="text-[10px] font-black uppercase text-slate-500">Destinatarios por rol</span><div className="mt-2 flex flex-wrap gap-2">{companyRoles.length ? companyRoles.map(role => <button type="button" key={role} onClick={() => setForm({ ...form, roles: form.roles.includes(role) ? form.roles.filter(x => x !== role) : [...form.roles, role] })} className={`rounded-full border px-3 py-2 text-[11px] font-bold ${form.roles.includes(role) ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 text-slate-600'}`}>{role}</button>) : <span className="text-xs text-slate-400">Crea roles en la pestaña Roles.</span>}</div></div>
          <label className="md:col-span-2"><span className="text-[10px] font-black uppercase text-slate-500">Usuarios específicos (opcional)</span><select multiple value={form.usuarios} onChange={e => setForm({ ...form, usuarios: [...e.target.selectedOptions].map(o => o.value) })} className="mt-1 h-28 w-full rounded-xl border border-slate-200 p-3 text-xs">{users.map(u => <option key={u.id} value={u.id}>{u.nombre || u.correo} · {u.rol}</option>)}</select><span className="text-[10px] text-slate-400">Ctrl/Cmd + clic para seleccionar más de uno.</span></label>
          <div className="md:col-span-2"><div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Correos adicionales</span><button type="button" onClick={() => setForm({ ...form, correos: [...form.correos, ''] })} className="text-[10px] font-black text-blue-700">+ Agregar correo</button></div><div className="mt-2 space-y-2">{form.correos.map((email, i) => <div key={i} className="flex gap-2"><input type="email" value={email} onChange={e => { const next = [...form.correos]; next[i] = e.target.value; setForm({ ...form, correos: next }); }} placeholder={`Correo ${i + 1}`} className="w-full rounded-xl border border-slate-200 p-3 text-xs" />{form.correos.length > 1 && <button type="button" onClick={() => setForm({ ...form, correos: form.correos.filter((_, x) => x !== i) })} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>}</div>)}</div></div>
          <div><span className="text-[10px] font-black uppercase text-slate-500">Canales</span><div className="mt-2 flex gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.canal_email} onChange={e => setForm({ ...form, canal_email: e.target.checked })} /> Correo</label><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={form.canal_plataforma} onChange={e => setForm({ ...form, canal_plataforma: e.target.checked })} /> Plataforma</label></div></div>
          <label><span className="text-[10px] font-black uppercase text-slate-500">Frecuencia</span><select value={form.frecuencia} onChange={e => setForm({ ...form, frecuencia: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs"><option>Inmediata</option><option>Diaria</option><option>Semanal</option><option>Anticipada</option></select></label>
          {form.frecuencia !== 'Inmediata' && <label><span className="text-[10px] font-black uppercase text-slate-500">Hora de envío</span><input type="time" value={form.hora_envio} onChange={e => setForm({ ...form, hora_envio: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs" /></label>}
          {form.frecuencia === 'Anticipada' && <label><span className="text-[10px] font-black uppercase text-slate-500">Días de anticipación</span><input type="number" min="1" value={form.dias_anticipacion} onChange={e => setForm({ ...form, dias_anticipacion: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-xs" /></label>}
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setModal(false)} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-bold text-slate-700">Cancelar</button><button type="submit" className="flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white"><Send className="h-4 w-4" /> Guardar regla</button></div>
      </form></div>}
      </>}
    </div>
  );
}
