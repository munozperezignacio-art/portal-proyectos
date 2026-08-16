import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://obraxis.cl", "https://www.obraxis.cl"]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": allowedOrigins.has(origin || "") ? origin! : "https://www.obraxis.cl",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(value => value.toString(16).padStart(2, "0")).join("");
const escapeHtml = (value: unknown, max: number) => String(value || "").trim().slice(0, max).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async request => {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return reply({ error: "Metodo no permitido" }, 405);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: "Origen no autorizado" }, 403);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!url || !serviceKey || !resendKey) return reply({ error: "Contacto temporalmente no disponible" }, 503);

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await hash(forwardedIp);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db.from("correo_sistema_intentos").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).eq("canal", "contacto").gte("created_at", since);
  if ((count || 0) >= 5) return reply({ error: "Demasiadas solicitudes. Intenta mas tarde." }, 429);

  try {
    const body = await request.json();
    if (String(body.website || "").trim()) return reply({ success: true });
    const nombre = escapeHtml(body.nombre, 120);
    const empresa = escapeHtml(body.empresa, 160);
    const correo = String(body.correo || "").trim().toLowerCase().slice(0, 160);
    const telefono = escapeHtml(body.telefono, 60);
    const mensaje = escapeHtml(body.mensaje, 3000);
    if (!nombre || !emailPattern.test(correo) || !mensaje) return reply({ error: "Completa nombre, correo y mensaje" }, 400);

    const { data: contact, error: contactError } = await db.from("contactos_publicos").insert({
      nombre, empresa_interesada: empresa || null, correo, telefono: telefono || null, mensaje,
      ip_hash: ipHash, origen: "landing_obraxis",
    }).select("id").single();
    if (contactError) return reply({ error: "No fue posible registrar la solicitud" }, 500);

    const html = `<div style="max-width:650px;margin:auto;padding:28px;font-family:Arial,sans-serif;color:#1e293b"><h2>Nueva solicitud desde obraxis.cl</h2><p><b>Nombre:</b> ${nombre}</p><p><b>Empresa:</b> ${empresa || "No indicada"}</p><p><b>Correo:</b> ${escapeHtml(correo, 160)}</p><p><b>Telefono:</b> ${telefono || "No indicado"}</p><hr><p style="white-space:pre-wrap">${mensaje}</p></div>`;
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Obraxis <notificaciones@obraxis.cl>", to: ["contacto@obraxis.cl"], reply_to: correo, subject: `Solicitud de cotizacion - ${empresa || nombre}`, html }),
    });
    const resendResult = await resendResponse.json().catch(() => ({}));
    let confirmationResponse: Response | null = null;
    let confirmationResult: Record<string, unknown> = {};
    if (resendResponse.ok) {
      const confirmationHtml = `<div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#17213a"><div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #dfe5ef;border-radius:20px;overflow:hidden"><div style="padding:24px 32px;background:#11182c"><img src="https://www.obraxis.cl/brand/obraxis-primary.png" alt="Obraxis" style="display:block;max-width:190px;max-height:64px;object-fit:contain"></div><div style="padding:32px"><h1 style="margin:0 0 18px;font-size:26px;color:#17213a">Gracias por contactarnos, ${nombre}</h1><p style="margin:0 0 14px;font-size:16px;line-height:1.65">Hemos recibido correctamente tu solicitud.</p><p style="margin:0 0 24px;font-size:16px;line-height:1.65">Nuestro equipo la revisará y se pondrá en contacto contigo a la brevedad.</p><div style="padding:18px 20px;background:#f7f9fc;border-left:4px solid #f2790b;border-radius:10px"><strong>Obraxis</strong><br><span style="color:#64748b">Gestión inteligente para construir mejor</span></div><p style="margin:26px 0 0;font-size:13px;line-height:1.5;color:#7b879d">Si necesitas agregar antecedentes, puedes responder este correo.</p></div></div></div>`;
      confirmationResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Obraxis <contacto@obraxis.cl>",
          to: [correo],
          reply_to: "contacto@obraxis.cl",
          subject: "Recibimos tu solicitud | Obraxis",
          html: confirmationHtml,
          text: `Gracias por contactarnos, ${nombre}.\n\nHemos recibido correctamente tu solicitud. Nuestro equipo la revisará y se pondrá en contacto contigo a la brevedad.\n\nSi necesitas agregar antecedentes, puedes responder este correo.\n\nObraxis\nGestión inteligente para construir mejor`,
        }),
      });
      confirmationResult = await confirmationResponse.json().catch(() => ({}));
    }
    console.log("contacto_publico_delivery", JSON.stringify({
      contacto_id: contact.id,
      aviso_interno_enviado: resendResponse.ok,
      confirmacion_enviada: confirmationResponse?.ok || false,
      confirmacion_con_id: Boolean(confirmationResponse?.ok && confirmationResult?.id),
    }));
    await db.from("contactos_publicos").update({ resend_id: resendResponse.ok ? resendResult?.id || null : null }).eq("id", contact.id);
    await db.from("correo_sistema_intentos").insert({ ip_hash: ipHash, canal: "contacto", exitoso: resendResponse.ok });
    await db.from("auditoria_plataforma").insert({
      empresa: "Obraxis", modulo: "contacto", categoria: "Correo", accion: "Recibir formulario publico",
      descripcion: "Solicitud de contacto procesada", entidad_tipo: "contacto_publico", origen: "Supabase Edge Function",
      resultado: resendResponse.ok ? "Exitoso" : "Error", nivel: resendResponse.ok ? "info" : "warning",
      entidad_id: String(contact.id), metadatos: {
        resend_id: resendResponse.ok ? resendResult?.id || null : null,
        confirmacion_enviada: confirmationResponse?.ok || false,
        confirmacion_resend_id: confirmationResponse?.ok ? confirmationResult?.id || null : null,
      },
    });
    if (!resendResponse.ok) return reply({ error: "No fue posible enviar la solicitud" }, 502);
    return reply({ success: true, confirmationSent: confirmationResponse?.ok || false });
  } catch {
    await db.from("correo_sistema_intentos").insert({ ip_hash: ipHash, canal: "contacto", exitoso: false });
    return reply({ error: "No fue posible procesar la solicitud" }, 400);
  }
});
