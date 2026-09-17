import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@6.9.2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);
const validUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!url || !serviceKey || !resendKey) return json({ error: "Bandeja no configurada" }, 503);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData?.user) return json({ error: "Debes iniciar sesión" }, 401);

  const profileResult = await db.from("usuarios")
    .select("id,auth_user_id,usuario,nombre,correo,empresa,rol,rol_base,permisos")
    .eq("auth_user_id", authData.user.id).eq("empresa", "Obraxis").maybeSingle();
  const profile = profileResult.data;
  if (!profile) return json({ error: "Cuenta no autorizada" }, 403);

  const roleResult = profile.rol
    ? await db.from("roles").select("permisos,archivado").eq("empresa", "Obraxis").eq("nombre", profile.rol).maybeSingle()
    : { data: null };
  const elevated = ["superusuario", "superadmin", "administrador", "admin", "gerencia"]
    .includes(String(profile.rol_base || profile.rol || "").toLowerCase());
  const allowed = elevated || profile.permisos?.["admin.contactos.ver"] === true
    || (roleResult.data?.archivado !== true && roleResult.data?.permisos?.["admin.contactos.ver"] === true);
  if (!allowed) return json({ error: "No tienes permiso para gestionar la bandeja" }, 403);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: "Solicitud inválida" }, 400); }
  const action = String(body?.action || "");
  const resend = new Resend(resendKey);

  if (action === "reply") {
    const conversationId = String(body.conversation_id || "");
    const text = String(body.text || "").trim().slice(0, 50000);
    if (!validUuid(conversationId) || !text) return json({ error: "Faltan conversación o mensaje" }, 400);

    const conversationResult = await db.from("correo_conversaciones").select("*").eq("id", conversationId).maybeSingle();
    const conversation = conversationResult.data;
    if (!conversation || conversation.empresa !== "Obraxis") return json({ error: "Conversación no encontrada" }, 404);
    if (!/^[^\s@]+@obraxis\.cl$/i.test(conversation.buzon || "")) return json({ error: "Buzón remitente inválido" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(conversation.participante_correo || "")) return json({ error: "Destinatario inválido" }, 400);

    const lastResult = await db.from("correo_mensajes").select("message_id")
      .eq("conversacion_id", conversationId).not("message_id", "is", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const lastMessageId = lastResult.data?.message_id || null;
    const subject = /^re\s*:/i.test(conversation.asunto || "") ? conversation.asunto : `Re: ${conversation.asunto || "Contacto Obraxis"}`;
    const created = await db.from("correo_mensajes").insert({
      conversacion_id: conversationId,
      direccion: "salida",
      estado: "pendiente",
      remitente_nombre: "Obraxis",
      remitente_correo: conversation.buzon,
      destinatarios: [conversation.participante_correo],
      asunto: subject,
      cuerpo_texto: text,
      cuerpo_html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#17213a;white-space:pre-wrap">${escapeHtml(text)}</div>`,
      in_reply_to: lastMessageId,
      actor_auth_user_id: authData.user.id,
      actor_nombre: profile.nombre || profile.usuario || profile.correo,
    }).select("id").single();
    if (created.error) return json({ error: "No fue posible preparar la respuesta" }, 500);

    const plusAddress = conversation.buzon.replace("@", `+${conversationId}@`);
    const headers = lastMessageId ? { "In-Reply-To": lastMessageId, "References": lastMessageId } : undefined;
    const sent = await resend.emails.send({
      from: `Obraxis <${conversation.buzon}>`,
      to: [conversation.participante_correo],
      replyTo: plusAddress,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#17213a;white-space:pre-wrap">${escapeHtml(text)}</div>`,
      headers,
    }, { idempotencyKey: `correo-${created.data.id}` });

    if (sent.error || !sent.data?.id) {
      await db.from("correo_mensajes").update({ estado: "error", error_detalle: sent.error?.message || "Resend rechazó el envío" }).eq("id", created.data.id);
      return json({ error: sent.error?.message || "No fue posible enviar la respuesta" }, 502);
    }

    let messageId: string | null = null;
    try {
      const retrieved = await resend.emails.get(sent.data.id);
      messageId = (retrieved.data as any)?.message_id || null;
    } catch { /* El webhook o una respuesta posterior todavía permiten correlacionar por plus-address. */ }

    await db.from("correo_mensajes").update({
      estado: "enviado",
      resend_email_id: sent.data.id,
      message_id: messageId,
      enviado_at: new Date().toISOString(),
    }).eq("id", created.data.id);
    await db.from("correo_conversaciones").update({ estado: "pendiente", no_leidos: 0 }).eq("id", conversationId);
    await db.from("auditoria_plataforma").insert({
      empresa: "Obraxis", modulo: "contacto", categoria: "Correo", accion: "Responder correo",
      descripcion: `Respuesta enviada por ${profile.nombre || profile.usuario || profile.correo}`,
      entidad_tipo: "correo_conversacion", entidad_id: conversationId, origen: "Bandeja Obraxis",
      resultado: "Exitoso", nivel: "info", metadatos: { resend_email_id: sent.data.id },
    });
    return json({ ok: true, message_id: created.data.id });
  }

  if (action === "attachment") {
    const messageId = String(body.message_id || "");
    const attachmentId = String(body.attachment_id || "");
    if (!validUuid(messageId) || !attachmentId) return json({ error: "Adjunto inválido" }, 400);
    const messageResult = await db.from("correo_mensajes").select("resend_email_id,adjuntos")
      .eq("id", messageId).eq("direccion", "entrada").maybeSingle();
    const message = messageResult.data;
    const metadata = (message?.adjuntos || []).find((item: any) => String(item.id) === attachmentId);
    if (!message?.resend_email_id || !metadata) return json({ error: "Adjunto no encontrado" }, 404);
    const result = await resend.emails.receiving.attachments.get({ emailId: message.resend_email_id, id: attachmentId });
    if (result.error || !result.data?.download_url) return json({ error: "No fue posible preparar la descarga" }, 502);
    return json({ ok: true, url: result.data.download_url, filename: metadata.filename });
  }

  return json({ error: "Acción no válida" }, 400);
});
