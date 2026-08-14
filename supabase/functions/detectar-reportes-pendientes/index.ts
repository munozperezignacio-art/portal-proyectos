import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EVENTS = ['avance_reporte_pendiente', 'maquinaria_reporte_pendiente', 'reportes_diarios_pendientes', 'prevencion_cumplimiento_pendiente'];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const localParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};
const asArray = (value: unknown) => Array.isArray(value) ? value : [];
const activeWork = (state: unknown) => !['inactiva', 'terminada', 'cerrada', 'finalizada'].includes(String(state || '').toLowerCase());
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return json({ error: 'No autorizado' }, 401);
  }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const now = new Date();
  const local = localParts(now);
  const lookback = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const { data: rules, error: ruleError } = await db.from('notificaciones_reglas').select('*').in('evento_codigo', EVENTS).eq('activa', true);
  if (ruleError) return json({ error: ruleError.message }, 500);
  const dueRules = (rules || []).filter((rule: any) => rule.evento_codigo === 'prevencion_cumplimiento_pendiente' || String(rule.hora_envio || '18:00').slice(0, 5) <= local.time);
  const results: any[] = [];

  for (const rule of dueRules) {
    try {
      if (rule.evento_codigo === 'prevencion_cumplimiento_pendiente') {
        results.push(await processCompliancePending(db, rule, local, now));
        continue;
      }
      const [{ data: works }, { data: users }, { data: advances }, { data: usage }, { data: legacyUsage }, { data: equipment }, { data: existing }, { data: mailConfig }] = await Promise.all([
        db.from('obras').select('id,nombre,estado').eq('empresa', rule.empresa),
        db.from('usuarios').select('id,usuario,nombre,correo,rol,obras').eq('empresa', rule.empresa),
        db.from('avances_produccion_partidas').select('obra_id,obra_nombre,created_at').eq('empresa', rule.empresa).gte('created_at', lookback),
        db.from('maquinaria_uso_diario').select('obra_nombre,fecha,created_at').eq('empresa', rule.empresa).gte('created_at', lookback),
        db.from('reporte_maquinaria').select('obra_nombre,created_at').gte('created_at', lookback),
        db.from('inventario_maquinaria').select('obra_nombre,estado_equipo').eq('empresa', rule.empresa),
        db.from('notificaciones_entregas').select('id,created_at,payload').eq('regla_id', rule.id).gte('created_at', lookback),
        db.from('config_empresa').select('email_sender').eq('empresa', 'Obraxis').maybeSingle()
      ]);

      if ((existing || []).some((item: any) => item.payload?.fecha_control === local.date || localParts(new Date(item.created_at)).date === local.date)) {
        results.push({ rule: rule.id, skipped: 'already_processed' });
        continue;
      }

      const conditions = rule.condiciones || {};
      const scope = conditions.alcance_tipo || (rule.obra_nombre ? 'seleccionadas' : 'todas');
      const selected = asArray(conditions.obras_seleccionadas);
      let names = (works || []).filter((work: any) => activeWork(work.estado)).map((work: any) => work.nombre);
      if (scope === 'seleccionadas') names = names.filter((name: string) => selected.includes(name) || name === rule.obra_nombre);
      if (scope === 'asignadas') {
        const assigned = new Set((users || []).flatMap((person: any) => String(person.obras || '').split(',').map((name: string) => name.trim()).filter(Boolean)));
        if (assigned.size) names = names.filter((name: string) => assigned.has(name));
      }

      const workNameById = new Map((works || []).map((work: any) => [String(work.id), work.nombre]));
      const advanceReported = new Set((advances || []).filter((item: any) => localParts(new Date(item.created_at)).date === local.date).map((item: any) => item.obra_id ? workNameById.get(String(item.obra_id)) : item.obra_nombre).filter(Boolean));
      const machineryReported = new Set([
        ...(usage || []).filter((item: any) => item.fecha === local.date || localParts(new Date(item.created_at)).date === local.date).map((item: any) => item.obra_nombre),
        ...(legacyUsage || []).filter((item: any) => localParts(new Date(item.created_at)).date === local.date).map((item: any) => item.obra_nombre)
      ]);
      const worksWithEquipment = new Set((equipment || []).filter((item: any) => item.obra_nombre && !['fuera de servicio', 'dado de baja'].includes(String(item.estado_equipo || '').toLowerCase())).map((item: any) => item.obra_nombre));
      const pendingAdvance = names.filter((name: string) => !advanceReported.has(name));
      const pendingMachinery = names.filter((name: string) => worksWithEquipment.has(name) && !machineryReported.has(name));
      const hasPending = rule.evento_codigo === 'avance_reporte_pendiente' ? pendingAdvance.length > 0 : rule.evento_codigo === 'maquinaria_reporte_pendiente' ? pendingMachinery.length > 0 : pendingAdvance.length > 0 || pendingMachinery.length > 0;
      if (!hasPending) {
        results.push({ rule: rule.id, skipped: 'nothing_pending' });
        continue;
      }

      const roleSet = new Set(asArray(rule.destinatarios_roles));
      const idSet = new Set(asArray(rule.destinatarios_usuarios).map(String));
      const recipients = [...new Set([
        ...(users || []).filter((person: any) => roleSet.has(person.rol) || idSet.has(String(person.id))).map((person: any) => person.correo),
        ...asArray(rule.correos_adicionales)
      ].filter(Boolean))];
      const title = rule.evento_codigo === 'avance_reporte_pendiente' ? 'Reportes de avance pendientes' : rule.evento_codigo === 'maquinaria_reporte_pendiente' ? 'Reportes de maquinaria pendientes' : 'Informes diarios pendientes';
      const list = (items: string[]) => items.length ? `<ul style="margin:8px 0 0;padding-left:20px">${items.map(name => `<li>${name}</li>`).join('')}</ul>` : '<p style="color:#047857">Sin pendientes.</p>';
      const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#17233b"><div style="background:#102b5c;color:white;padding:22px;border-radius:16px 16px 0 0"><h2 style="margin:0">${title}</h2><p style="margin:6px 0 0;color:#cbd5e1">${rule.empresa} · ${local.date}</p></div><div style="padding:22px;border:1px solid #dbe3ef;border-top:0;border-radius:0 0 16px 16px"><p>Al cierre configurado aún faltan los siguientes informes:</p>${rule.evento_codigo !== 'maquinaria_reporte_pendiente' ? `<h3 style="font-size:14px;margin-top:18px">Avance de obra (${pendingAdvance.length})</h3>${list(pendingAdvance)}` : ''}${rule.evento_codigo !== 'avance_reporte_pendiente' ? `<h3 style="font-size:14px;margin-top:18px">Uso de maquinaria (${pendingMachinery.length})</h3>${list(pendingMachinery)}` : ''}<div style="margin-top:20px;padding:12px;background:#f8fafc;border-radius:10px;font-size:12px;color:#475569"><b>Importante:</b> informar avance 0 o equipo sin uso también cumple el reporte diario. La alerta solo identifica la ausencia total del registro.</div></div></div>`;
      let emailState = 'Omitido';
      let errorDetail: string | null = null;
      if (rule.canal_email && recipients.length) {
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (!resendApiKey) throw new Error('Resend no está configurado');
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: `Obraxis <${mailConfig?.email_sender || 'notificaciones@obraxis.cl'}>`, to: recipients, subject: `${title} · ${rule.empresa}`, html }) });
        emailState = response.ok ? 'Enviada' : 'Error';
        if (!response.ok) errorDetail = await response.text();
      }
      const payload = { fecha_control: local.date, avance_pendiente: pendingAdvance, maquinaria_pendiente: pendingMachinery };
      const deliveries = [
        ...(rule.canal_email ? recipients.map((recipient: string) => ({ regla_id: rule.id, empresa: rule.empresa, evento_codigo: rule.evento_codigo, canal: 'Email', destinatario: recipient, asunto: title, estado: emailState, error_detalle: errorDetail, payload, programada_para: now.toISOString(), enviada_at: emailState === 'Enviada' ? now.toISOString() : null })) : []),
        ...(rule.canal_plataforma ? [{ regla_id: rule.id, empresa: rule.empresa, evento_codigo: rule.evento_codigo, canal: 'Plataforma', destinatario: 'Roles y usuarios configurados', asunto: title, estado: 'Pendiente', payload, programada_para: now.toISOString() }] : [])
      ];
      if (deliveries.length) await db.from('notificaciones_entregas').insert(deliveries);
      results.push({ rule: rule.id, pendingAdvance: pendingAdvance.length, pendingMachinery: pendingMachinery.length, deliveries: deliveries.length });
    } catch (error) {
      results.push({ rule: rule.id, error: String(error) });
    }
  }
  return json({ date: local.date, time: local.time, processed: results.length, results });
});

async function processCompliancePending(db: any, rule: any, local: { date: string; time: string }, now: Date) {
  const [{ data: assignments, error: assignmentError }, { data: users }, { data: mailConfig }] = await Promise.all([
    db.from('prevencion_cumplimiento_asignaciones').select('id,empresa,usuario_id,formulario_id,trabajador_nombre,registro_nombre,frecuencia,hora_limite,dia_semana,dia_mes').eq('empresa', rule.empresa).eq('activo', true).eq('notificar_pendiente', true),
    db.from('usuarios').select('id,nombre,correo,rol').eq('empresa', rule.empresa),
    db.from('config_empresa').select('email_sender').eq('empresa', 'Obraxis').maybeSingle()
  ]);
  if (assignmentError) throw assignmentError;

  const today = new Date(`${local.date}T12:00:00Z`);
  const weekday = today.getUTCDay();
  const dayOfMonth = today.getUTCDate();
  const due = (assignments || []).filter((item: any) => {
    if (String(item.hora_limite || '17:00').slice(0, 5) > local.time) return false;
    if (item.frecuencia === 'Diario') return weekday >= 1 && weekday <= 5;
    if (item.frecuencia === 'Semanal') return weekday >= Number(item.dia_semana || 4) && weekday <= 5;
    if (item.frecuencia === 'Mensual') return dayOfMonth >= Number(item.dia_mes || 20);
    return false;
  });
  if (!due.length) return { rule: rule.id, skipped: 'nothing_due' };

  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - Math.max(0, weekday - 1));
  const monthStart = `${local.date.slice(0, 7)}-01`;
  const earliest = isoDate(new Date(Math.min(monday.getTime(), new Date(`${monthStart}T12:00:00Z`).getTime())));
  const assignmentIds = due.map((item: any) => item.id);
  const formIds = [...new Set(due.map((item: any) => item.formulario_id).filter(Boolean))];
  const [{ data: logs }, { data: responses }, { data: existingDeliveries }] = await Promise.all([
    db.from('prevencion_cumplimiento_registros').select('asignacion_id,fecha_cumplimiento,estado').in('asignacion_id', assignmentIds).gte('fecha_cumplimiento', earliest).lte('fecha_cumplimiento', local.date),
    formIds.length ? db.from('prevencion_respuestas').select('formulario_id,inspector,created_at').in('formulario_id', formIds).gte('created_at', `${earliest}T00:00:00-04:00`) : Promise.resolve({ data: [] }),
    db.from('notificaciones_entregas').select('id,payload,created_at').eq('regla_id', rule.id).gte('created_at', new Date(now.getTime() - 40 * 86400000).toISOString())
  ]);

  const periodFor = (item: any) => item.frecuencia === 'Diario'
    ? local.date
    : item.frecuencia === 'Semanal'
      ? `S-${isoDate(monday)}`
      : `M-${local.date.slice(0, 7)}`;
  const alreadySent = new Set((existingDeliveries || []).map((entry: any) => `${entry.payload?.asignacion_id || ''}|${entry.payload?.periodo || ''}`));
  const pending = due.filter((item: any) => {
    const period = periodFor(item);
    if (alreadySent.has(`${item.id}|${period}`)) return false;
    const from = item.frecuencia === 'Diario' ? local.date : item.frecuencia === 'Semanal' ? isoDate(monday) : monthStart;
    const hasManual = (logs || []).some((log: any) => Number(log.asignacion_id) === Number(item.id) && log.fecha_cumplimiento >= from && log.fecha_cumplimiento <= local.date);
    const assignee = String(item.trabajador_nombre || '').trim().toLowerCase();
    const hasForm = (responses || []).some((response: any) => Number(response.formulario_id) === Number(item.formulario_id) && String(response.inspector || '').trim().toLowerCase() === assignee && localParts(new Date(response.created_at)).date >= from && localParts(new Date(response.created_at)).date <= local.date);
    return !hasManual && !hasForm;
  });
  if (!pending.length) return { rule: rule.id, skipped: 'nothing_pending' };

  const roleSet = new Set(asArray(rule.destinatarios_roles));
  const idSet = new Set(asArray(rule.destinatarios_usuarios).map(String));
  const platformRecipients = [...new Set([
    ...pending.map((item: any) => String(item.usuario_id)),
    ...(users || []).filter((person: any) => roleSet.has(person.rol) || idSet.has(String(person.id))).map((person: any) => String(person.id))
  ].filter(Boolean))];
  const emailRecipients = [...new Set([
    ...pending.map((item: any) => (users || []).find((person: any) => String(person.id) === String(item.usuario_id))?.correo),
    ...(users || []).filter((person: any) => roleSet.has(person.rol) || idSet.has(String(person.id))).map((person: any) => person.correo),
    ...asArray(rule.correos_adicionales)
  ].filter(Boolean))];
  const title = 'Cumplimientos preventivos pendientes';
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#17233b"><div style="background:#102b5c;color:white;padding:22px;border-radius:16px 16px 0 0"><h2 style="margin:0">${title}</h2><p style="margin:6px 0 0;color:#cbd5e1">${escapeHtml(rule.empresa)} · ${local.date}</p></div><div style="padding:22px;border:1px solid #dbe3ef;border-top:0;border-radius:0 0 16px 16px"><p>Existen cumplimientos preventivos pendientes al cierre configurado.</p><p>Ingresa a Obraxis para consultar el detalle según tus permisos.</p><p style="margin-top:18px;font-size:12px;color:#64748b">Este aviso no incluye respuestas ni detalles del formulario y no modifica registros automáticamente.</p></div></div>`;
  let emailState = 'Omitido';
  let errorDetail: string | null = null;
  if (rule.canal_email && emailRecipients.length) {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('Resend no está configurado');
    const responses = await Promise.all(emailRecipients.map((recipient: string) => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `Obraxis <${mailConfig.email_sender || 'notificaciones@obraxis.cl'}>`, to: [recipient], subject: `${title} · ${rule.empresa}`, html })
    })));
    emailState = responses.every(response => response.ok) ? 'Enviada' : 'Error';
    if (emailState === 'Error') errorDetail = (await Promise.all(responses.filter(response => !response.ok).map(response => response.text()))).join(' | ');
  }
  const deliveries = pending.flatMap((item: any) => {
    const payload = { asignacion_id: item.id, formulario_id: item.formulario_id, usuario_id: item.usuario_id, periodo: periodFor(item), fecha_control: local.date };
    return [
      ...(rule.canal_plataforma ? platformRecipients.map((recipient: string) => ({ regla_id: rule.id, empresa: rule.empresa, evento_codigo: rule.evento_codigo, canal: 'Plataforma', destinatario: recipient, asunto: recipient === String(item.usuario_id) ? `${item.registro_nombre} pendiente` : title, estado: 'Pendiente', payload, programada_para: now.toISOString() })) : []),
      ...(rule.canal_email ? emailRecipients.map((recipient: string) => ({ regla_id: rule.id, empresa: rule.empresa, evento_codigo: rule.evento_codigo, canal: 'Email', destinatario: recipient, asunto: title, estado: emailState, error_detalle: errorDetail, payload, programada_para: now.toISOString(), enviada_at: emailState === 'Enviada' ? now.toISOString() : null })) : [])
    ];
  });
  if (deliveries.length) await db.from('notificaciones_entregas').insert(deliveries);
  return { rule: rule.id, pending: pending.length, deliveries: deliveries.length };
}
