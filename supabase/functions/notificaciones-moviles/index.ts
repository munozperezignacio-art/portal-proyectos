import { notificationRecipient } from "../_shared/notificationRecipients.mjs";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const isRecipient = notificationRecipient;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Metodo no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!, serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const db = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Sesion no valida" }, 401);
    const body = await req.json();
    const { data: profile } = await db.from("usuarios").select("id,auth_user_id,usuario,nombre,correo,empresa,rol,rol_base,obras").eq("auth_user_id", auth.user.id).eq("id", body.perfil_id).maybeSingle();
    if (!profile) return reply({ error: "Perfil no autorizado" }, 403);

    if (body.action === "register") {
      const pushToken = String(body.expo_push_token || "");
      if (!/^ExponentPushToken\[[\w-]+\]$|^ExpoPushToken\[[\w-]+\]$/.test(pushToken)) return reply({ error: "Token movil no valido" }, 400);
      const row = { auth_user_id: auth.user.id, perfil_id: String(profile.id), empresa: profile.empresa, expo_push_token: pushToken, dispositivo_id: String(body.dispositivo_id || "").slice(0, 180), plataforma: body.plataforma === "ios" ? "ios" : "android", app_version: String(body.app_version || "").slice(0, 30), activo: true, ultimo_acceso_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (!row.dispositivo_id) return reply({ error: "Dispositivo no identificado" }, 400);
      await db.from("notificaciones_dispositivos").delete().eq("auth_user_id", auth.user.id).eq("empresa", profile.empresa).eq("dispositivo_id", row.dispositivo_id).neq("expo_push_token", pushToken);
      const { error } = await db.from("notificaciones_dispositivos").upsert(row, { onConflict: "expo_push_token" });
      if (error) throw error;
      return reply({ ok: true });
    }
    if (body.action === "unregister") {
      await db.from("notificaciones_dispositivos").update({ activo: false, updated_at: new Date().toISOString() }).eq("auth_user_id", auth.user.id).eq("perfil_id", String(profile.id)).eq("dispositivo_id", String(body.dispositivo_id || ""));
      return reply({ ok: true });
    }
    if (body.action === "read" || body.action === "detail") {
      const deliveryId = Number(body.entrega_id);
      const { data: delivery } = await db.from("notificaciones_entregas").select("*,notificaciones_reglas(*)").eq("id", deliveryId).eq("empresa", profile.empresa).maybeSingle();
      if (!delivery || !isRecipient(delivery, profile)) return reply({ error: "Notificacion no autorizada" }, 403);
      if (body.action === "detail") {
        const { notificaciones_reglas: _rule, ...detail } = delivery;
        return reply({ data: detail });
      }
      const { error: readError } = await db.from("notificaciones_lecturas").upsert({ entrega_id: deliveryId, auth_user_id: auth.user.id, leida_at: new Date().toISOString() });
      if (readError) throw readError;
      return reply({ ok: true });
    }
    if (body.action === "inbox") {
      const fields = "id,destinatario,evento_codigo,obra_nombre,asunto,payload,created_at,notificaciones_reglas(*)";
      const [general, direct] = await Promise.all([
        db.from("notificaciones_entregas").select(fields).eq("empresa", profile.empresa).eq("canal", "Plataforma").order("created_at", { ascending: false }).limit(150),
        db.from("notificaciones_entregas").select(fields).eq("empresa", profile.empresa).eq("canal", "Plataforma").in("destinatario", [String(profile.id), profile.usuario, profile.correo].filter(Boolean)).order("created_at", { ascending: false }).limit(60),
      ]);
      if (general.error || direct.error) throw general.error || direct.error;
      const deliveries = [...new Map([...(general.data || []), ...(direct.data || [])].map(row => [row.id, row])).values()];
      const allowed = deliveries.filter(row => isRecipient(row, profile)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
      const ids = allowed.map(row => row.id);
      const { data: reads } = ids.length ? await db.from("notificaciones_lecturas").select("entrega_id,leida_at").eq("auth_user_id", auth.user.id).in("entrega_id", ids) : { data: [] };
      const readMap = new Map((reads || []).map(row => [row.entrega_id, row.leida_at]));
      return reply({ data: allowed.map(({ notificaciones_reglas: _rule, ...row }) => ({ ...row, leida_at: readMap.get(row.id) || null })) });
    }
    return reply({ error: "Accion no valida" }, 400);
  } catch (error) { return reply({ error: error instanceof Error ? error.message : String(error) }, 400); }
});
