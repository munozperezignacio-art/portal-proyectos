import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EVENTS = ['avance_reporte_pendiente', 'maquinaria_reporte_pendiente', 'reportes_diarios_pendientes'];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const localParts = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};
const asArray = (value: unknown) => Array.isArray(value) ? value : [];
const activeWork = (state: unknown) => !['inactiva', 'terminada', 'cerrada', 'finalizada'].includes(String(state || '').toLowerCase());

Deno.serve(async () => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const now = new Date();
  const local = localParts(now);
  const lookback = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString();
  const { data: rules, error: ruleError } = await db.from('notificaciones_reglas').select('*').in('evento_codigo', EVENTS).eq('activa', true);
  if (ruleError) return json({ error: ruleError.message }, 500);
  const dueRules = (rules || []).filter((rule: any) => String(rule.hora_envio || '18:00').slice(0, 5) <= local.time);
  const results: any[] = [];

  for (const rule of dueRules) {
    try {
      const [{ data: works }, { data: users }, { data: advances }, { data: usage }, { data: legacyUsage }, { data: equipment }, { data: existing }, { data: mailConfig }] = await Promise.all([
        db.from('obras').select('id,nombre,estado').eq('empresa', rule.empresa),
        db.from('usuarios').select('id,usuario,nombre,correo,rol,obras').eq('empresa', rule.empresa),
        db.from('avances_produccion_partidas').select('obra_id,obra_nombre,created_at').eq('empresa', rule.empresa).gte('created_at', lookback),
        db.from('maquinaria_uso_diario').select('obra_nombre,fecha,created_at').eq('empresa', rule.empresa).gte('created_at', lookback),
        db.from('reporte_maquinaria').select('obra_nombre,created_at').gte('created_at', lookback),
        db.from('inventario_maquinaria').select('obra_nombre,estado_equipo').eq('empresa', rule.empresa),
        db.from('notificaciones_entregas').select('id,created_at,payload').eq('regla_id', rule.id).gte('created_at', lookback),
        db.from('config_empresa').select('email_api_key,email_sender').eq('empresa', 'Obraxis').maybeSingle()
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
        if (!mailConfig?.email_api_key) throw new Error('Resend no está configurado');
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${mailConfig.email_api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: `Obraxis <${mailConfig.email_sender || 'notificaciones@obraxis.cl'}>`, to: recipients, subject: `${title} · ${rule.empresa}`, html }) });
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
