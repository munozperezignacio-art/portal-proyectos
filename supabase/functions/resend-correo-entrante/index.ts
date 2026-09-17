import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@6.9.2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const normalizeSubject = (value: unknown) => String(value || "(sin asunto)")
  .replace(/^\s*((re|rv|fw|fwd)\s*:\s*)+/i, "")
  .trim()
  .slice(0, 300) || "(sin asunto)";

const parseMailbox = (value: unknown) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(.*?)\s*<([^<>]+)>\s*$/);
  return {
    name: (match?.[1] || "").replace(/^['"]|['"]$/g, "").trim().slice(0, 160) || null,
    email: (match?.[2] || raw).trim().toLowerCase().slice(0, 320),
  };
};

const headerValue = (headers: unknown, name: string) => {
  if (!headers) return null;
  if (Array.isArray(headers)) {
    const found = headers.find((item: any) => String(item?.name || item?.key || "").toLowerCase() === name.toLowerCase());
    return found ? String(found.value || "").trim() || null : null;
  }
  if (typeof headers === "object") {
    const entry = Object.entries(headers as Record<string, unknown>)
      .find(([key]) => key.toLowerCase() === name.toLowerCase());
    return entry ? String(entry[1] || "").trim() || null : null;
  }
  return null;
};

const conversationToken = (addresses: unknown) => {
  const match = (Array.isArray(addresses) ? addresses : [addresses])
    .map(value => String(value || "").toLowerCase())
    .join(" ")
    .match(/\+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@obraxis\.cl/i);
  return match?.[1] || null;
};

Deno.serve(async request => {
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const webhookSecret = Deno.env.get("RESEND_INBOUND_WEBHOOK_SECRET");
  if (!url || !serviceKey || !resendKey || !webhookSecret) {
    return json({ error: "Recepción de correo no configurada" }, 503);
  }

  const payload = await request.text();
  const resend = new Resend(resendKey);
  let event: any;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") || "",
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
      webhookSecret,
    });
  } catch {
    return json({ error: "Firma de webhook inválida" }, 400);
  }

  if (event?.type !== "email.received") return json({ ok: true, ignored: true });
  const emailId = String(event?.data?.email_id || "");
  if (!emailId) return json({ error: "Evento sin email_id" }, 400);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: duplicate } = await db.from("correo_mensajes")
    .select("id").eq("resend_email_id", emailId).maybeSingle();
  if (duplicate) return json({ ok: true, duplicate: true });

  const { data: received, error: receivedError } = await resend.emails.receiving.get(emailId);
  if (receivedError || !received) {
    console.error("resend_inbound_get_failed", receivedError);
    return json({ error: "No fue posible recuperar el correo" }, 502);
  }

  const sender = parseMailbox(received.from || event.data.from);
  if (!sender.email || sender.email.endsWith("@obraxis.cl")) {
    return json({ ok: true, ignored: true, reason: "internal_sender" });
  }

  const to = Array.isArray(received.to) ? received.to : (event.data.to || []);
  const cc = Array.isArray(received.cc) ? received.cc : (event.data.cc || []);
  const subject = String(received.subject || event.data.subject || "(sin asunto)").slice(0, 500);
  const normalizedSubject = normalizeSubject(subject);
  const inReplyTo = headerValue(received.headers, "in-reply-to");
  const references = headerValue(received.headers, "references");
  const messageId = String(received.message_id || event.data.message_id || headerValue(received.headers, "message-id") || "").slice(0, 1000) || null;
  const token = conversationToken([...to, ...cc]);

  let conversation: any = null;
  if (token) {
    const result = await db.from("correo_conversaciones").select("*").eq("id", token).maybeSingle();
    conversation = result.data;
  }
  if (!conversation && inReplyTo) {
    const result = await db.from("correo_mensajes")
      .select("conversacion_id").eq("message_id", inReplyTo).maybeSingle();
    if (result.data?.conversacion_id) {
      const thread = await db.from("correo_conversaciones").select("*").eq("id", result.data.conversacion_id).maybeSingle();
      conversation = thread.data;
    }
  }
  if (!conversation) {
    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const candidates = await db.from("correo_conversaciones").select("*")
      .eq("participante_correo", sender.email).neq("estado", "spam")
      .gte("ultimo_mensaje_at", since).order("ultimo_mensaje_at", { ascending: false }).limit(20);
    conversation = (candidates.data || []).find(item => normalizeSubject(item.asunto) === normalizedSubject) || null;
  }
  if (!conversation) {
    const target = parseMailbox(to[0] || "contacto@obraxis.cl").email || "contacto@obraxis.cl";
    const created = await db.from("correo_conversaciones").insert({
      buzon: target,
      participante_nombre: sender.name,
      participante_correo: sender.email,
      asunto: normalizedSubject,
      estado: "nuevo",
      no_leidos: 0,
    }).select("*").single();
    if (created.error) return json({ error: "No fue posible crear la conversación" }, 500);
    conversation = created.data;
  }

  const attachments = (received.attachments || event.data.attachments || []).map((item: any) => ({
    id: item.id,
    filename: String(item.filename || "adjunto").slice(0, 255),
    content_type: String(item.content_type || "application/octet-stream").slice(0, 160),
    content_disposition: item.content_disposition || null,
    content_id: item.content_id || null,
    size: item.size || null,
  }));

  const inserted = await db.from("correo_mensajes").insert({
    conversacion_id: conversation.id,
    direccion: "entrada",
    estado: "recibido",
    resend_email_id: emailId,
    message_id: messageId,
    in_reply_to: inReplyTo || references,
    remitente_nombre: sender.name,
    remitente_correo: sender.email,
    destinatarios: to,
    cc,
    asunto: subject,
    cuerpo_texto: String(received.text || "").slice(0, 200000) || null,
    cuerpo_html: String(received.html || "").slice(0, 500000) || null,
    adjuntos: attachments,
    recibido_at: received.created_at || event.data.created_at || event.created_at || new Date().toISOString(),
  }).select("id").single();

  if (inserted.error) {
    if (inserted.error.code === "23505") return json({ ok: true, duplicate: true });
    console.error("resend_inbound_insert_failed", inserted.error);
    return json({ error: "No fue posible almacenar el correo" }, 500);
  }

  await db.from("auditoria_plataforma").insert({
    empresa: "Obraxis",
    modulo: "contacto",
    categoria: "Correo",
    accion: "Recibir correo",
    descripcion: `Correo recibido en ${conversation.buzon}`,
    entidad_tipo: "correo_conversacion",
    entidad_id: String(conversation.id),
    origen: "Resend Inbound",
    resultado: "Exitoso",
    nivel: "info",
    metadatos: { resend_email_id: emailId, message_id: messageId, adjuntos: attachments.length },
  });

  return json({ ok: true, conversation_id: conversation.id, message_id: inserted.data.id });
});
