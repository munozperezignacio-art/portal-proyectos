import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { notificationRecipient, pushEnabled } from "../_shared/notificationRecipients.mjs";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
Deno.serve(async req => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: valid, error: authorizationError } = await db.rpc("verify_internal_cron_secret", { p_secret: req.headers.get("x-cron-secret") || "" });
    if (authorizationError || valid !== true) return json({ error: "No autorizado" }, 401);
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    let sent = 0, errors = 0, cursor = 0;
    // Keyset pagination prevents processed events from starving newer ones.
    for (;;) {
      const { data: deliveries, error } = await db.from("notificaciones_entregas")
        .select("id,empresa,evento_codigo,obra_nombre,destinatario,asunto,payload,created_at,notificaciones_reglas(*)")
        .eq("canal", "Plataforma").in("estado", ["Enviada", "Leída"])
        .gte("created_at", since).gt("id", cursor).order("id").limit(300);
      if (error) throw error;
      if (!deliveries?.length) break;
      for (const delivery of deliveries) {
        cursor = delivery.id;
        if (!pushEnabled(delivery)) continue;
        const [deviceResult, profileResult] = await Promise.all([
          db.from("notificaciones_dispositivos").select("*").eq("empresa", delivery.empresa).eq("activo", true),
          db.from("usuarios").select("id,auth_user_id,usuario,correo,empresa,rol,rol_base,obras").eq("empresa", delivery.empresa)
        ]);
        if (deviceResult.error || profileResult.error) throw deviceResult.error || profileResult.error;
        const profileMap = new Map((profileResult.data || []).map((p: any) => [String(p.id), p]));
        for (const device of deviceResult.data || []) {
          const profile: any = profileMap.get(String(device.perfil_id));
          if (!profile || profile.auth_user_id !== device.auth_user_id || !notificationRecipient(delivery, profile)) continue;
          // The unique key reserves the send BEFORE contacting Expo, including concurrent workers.
          const { data: claim, error: claimError } = await db.from("notificaciones_push_entregas")
            .insert({ entrega_id: delivery.id, dispositivo_id: device.id, estado: "Pendiente" }).select("id").single();
          if (claimError?.code === "23505") continue;
          if (claimError || !claim) throw claimError || new Error("No se pudo reservar el envío");
          try {
            const message = {
              to: device.expo_push_token, sound: "default", channelId: "operacion", priority: "high",
              title: "Obraxis · nuevo aviso",
              body: "Tienes un nuevo aviso en Obraxis. Abre la app para consultar el detalle.",
              // Do not send project names, amounts, report text or people to the push provider.
              data: { entregaId: delivery.id, route: "/notificacion/" + delivery.id }
            };
            const response = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(message), signal: AbortSignal.timeout(15000)
            });
            const result = await response.json(), ticket = result?.data;
            const ok = response.ok && ticket?.status === "ok";
            const { error: saveError } = await db.from("notificaciones_push_entregas").update({
              estado: ok ? "Enviada" : "Error", expo_ticket_id: ticket?.id || null,
              error_detalle: ok ? null : String(ticket?.message || "Respuesta no aceptada; revisar antes de reintentar").slice(0, 500),
              enviada_at: ok ? new Date().toISOString() : null
            }).eq("id", claim.id);
            if (saveError) throw saveError;
            if (ok) sent++; else errors++;
            if (ticket?.details?.error === "DeviceNotRegistered") await db.from("notificaciones_dispositivos").update({ activo: false, updated_at: new Date().toISOString() }).eq("id", device.id);
          } catch {
            errors++;
            await db.from("notificaciones_push_entregas").update({ estado: "Error", error_detalle: "Resultado incierto. No reenviar automáticamente; revisar el proveedor." }).eq("id", claim.id);
          }
        }
      }
      if (deliveries.length < 300) break;
    }
    return json({ ok: true, accepted: sent, errors });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400); }
});
