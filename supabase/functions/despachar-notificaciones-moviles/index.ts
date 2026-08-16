import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const list = (value: unknown) => Array.isArray(value) ? value.map(String) : [];
const works = (value: unknown) => Array.isArray(value) ? value.map(String) : String(value || "").split(",").map(x => x.trim()).filter(Boolean);
const routeFor = (code: string) => code.startsWith("maquinaria_") || code.startsWith("mantenimiento_") ? "/maquinaria" : code.startsWith("rrhh_") ? "/personal" : code.startsWith("prevencion_") ? "/formularios" : "/obras";
function eligible(rule: any, delivery: any, profile: any) {
  const target = String(delivery.destinatario || "").toLowerCase();
  if ([profile.id, profile.usuario, profile.correo].filter(Boolean).map((x: unknown) => String(x).toLowerCase()).includes(target)) return true;
  const userMatch = list(rule.destinatarios_usuarios).map(x => x.toLowerCase()).includes(String(profile.id).toLowerCase());
  const roleMatch = list(rule.destinatarios_roles).map(x => x.toLowerCase()).includes(String(profile.rol || profile.rol_base || "").toLowerCase());
  if (!userMatch && !roleMatch) return false;
  const scope = rule.condiciones?.alcance_tipo || (rule.obra_nombre ? "seleccionadas" : "todas");
  if (scope === "todas") return true;
  const work = String(delivery.obra_nombre || "").toLowerCase();
  if (scope === "asignadas") { const assigned = works(profile.obras).map(x => x.toLowerCase()); return assigned.includes("todas") || assigned.includes(work); }
  return list(rule.condiciones?.obras_seleccionadas).map(x => x.toLowerCase()).includes(work) || String(rule.obra_nombre || "").toLowerCase() === work;
}
Deno.serve(async req => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: valid } = await db.rpc("verify_internal_cron_secret", { p_secret: req.headers.get("x-cron-secret") || "" });
    if (valid !== true) return json({ error: "No autorizado" }, 401);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: deliveries, error } = await db.from("notificaciones_entregas").select("id,empresa,evento_codigo,obra_nombre,destinatario,asunto,payload,created_at,notificaciones_reglas(*)").eq("canal", "Plataforma").gte("created_at", since).order("created_at").limit(300);
    if (error) throw error;
    let sent = 0, omitted = 0;
    for (const delivery of deliveries || []) {
      const rule: any = delivery.notificaciones_reglas;
      if (!rule?.activa || !rule?.canal_push) continue;
      const [{ data: devices }, { data: profiles }] = await Promise.all([
        db.from("notificaciones_dispositivos").select("*").eq("empresa", delivery.empresa).eq("activo", true),
        db.from("usuarios").select("id,usuario,correo,empresa,rol,rol_base,obras").eq("empresa", delivery.empresa)
      ]);
      const profileMap = new Map((profiles || []).map((p: any) => [String(p.id), p]));
      for (const device of devices || []) {
        const profile = profileMap.get(String(device.perfil_id)); if (!profile || !eligible(rule, delivery, profile)) continue;
        const { data: prior } = await db.from("notificaciones_push_entregas").select("id").eq("entrega_id", delivery.id).eq("dispositivo_id", device.id).maybeSingle();
        if (prior) continue;
        const work = delivery.obra_nombre ? ` · ${delivery.obra_nombre}` : "";
        const message = { to: device.expo_push_token, sound: "default", channelId: "operacion", priority: "high", title: delivery.asunto || rule.nombre || "Obraxis", body: `Tienes una novedad operacional${work}. Ingresa a Obraxis para revisar el detalle.`, data: { entregaId: delivery.id, eventoCodigo: delivery.evento_codigo, route: routeFor(delivery.evento_codigo), obra: delivery.obra_nombre || "" } };
        const response = await fetch("https://exp.host/--/api/v2/push/send", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" }, body: JSON.stringify(message) });
        const result = await response.json(); const ticket = result?.data;
        const ok = response.ok && ticket?.status === "ok";
        await db.from("notificaciones_push_entregas").insert({ entrega_id: delivery.id, dispositivo_id: device.id, estado: ok ? "Enviada" : "Error", expo_ticket_id: ticket?.id || null, error_detalle: ok ? null : String(ticket?.message || result?.errors?.[0]?.message || "Expo rechazo el envio").slice(0, 500), enviada_at: ok ? new Date().toISOString() : null });
        if (ok) sent++; else omitted++;
        if (ticket?.details?.error === "DeviceNotRegistered") await db.from("notificaciones_dispositivos").update({ activo: false, updated_at: new Date().toISOString() }).eq("id", device.id);
      }
    }
    return json({ ok: true, sent, errors: omitted });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400); }
});
