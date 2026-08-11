import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const { token, clave, action = "load", obra_nombre, detalle } = await req.json();
    if (!token || !clave) return json({ error: "Token y clave son obligatorios" }, 400);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: portal } = await supabase.from("clientes_portales").select("*").eq("token", token).eq("activo", true).maybeSingle();
    if (!portal || portal.clave_hash !== await hash(String(clave).trim().toUpperCase())) return json({ error: "Credenciales inválidas" }, 401);
    const { data: accesses } = await supabase.from("clientes_portal_obras").select("*").eq("portal_id", portal.id).eq("publicada", true).order("obra_nombre");

    if (action === "comment") {
      const access = (accesses || []).find(item => item.obra_nombre === obra_nombre);
      if (!access?.permite_comentar || !String(detalle || "").trim()) return json({ error: "Comentario no autorizado o vacío" }, 403);
      await supabase.from("clientes_portal_eventos").insert({ portal_id: portal.id, empresa: portal.empresa, obra_nombre, accion: "Comentario del cliente", actor: portal.contacto_nombre, detalle: String(detalle).trim() });
      return json({ success: true });
    }

    const obras = await Promise.all((accesses || []).map(async access => {
      const p = access.permisos || {};
      const { data: obra } = await supabase.from("obras").select("nombre,tipo,area,ubicacion,estado,cliente,imagen_base64,administrador,admin_contrato").eq("empresa", portal.empresa).eq("nombre", access.obra_nombre).maybeSingle();
      const result: Record<string, unknown> = { obra, permisos: p, permite_comentar: access.permite_comentar };
      if (p.avance) result.avances = (await supabase.from("avances_produccion_partidas").select("id,created_at,frente,partida,unidad,cantidad,observaciones").eq("obra_nombre", access.obra_nombre).order("created_at", { ascending: false }).limit(50)).data || [];
      if (p.programacion) result.programacion = (await supabase.from("planificacion_tareas").select("id,codigo,tarea,fecha_inicio,fecha_fin,porcentaje_avance,estado,duracion").eq("obra_nombre", access.obra_nombre).order("fecha_inicio")).data || [];
      if (p.bitacora) result.bitacora = (await supabase.from("bitacora_eventos_obra").select("id,categoria,accion,detalle,actor,fecha").eq("empresa", portal.empresa).eq("obra_nombre", access.obra_nombre).order("fecha", { ascending: false }).limit(40)).data || [];
      if (p.calidad) {
        result.rdi = (await supabase.from("calidad_rdi").select("id,codigo,fecha_solicitud,partida,sector,estado,observaciones").eq("empresa", portal.empresa).eq("obra_nombre", access.obra_nombre).order("fecha_solicitud", { ascending: false }).limit(40)).data || [];
        result.recepciones = (await supabase.from("calidad_recepciones_partidas").select("id,codigo,fecha_entrega,partida,sector,estado,observaciones").eq("empresa", portal.empresa).eq("obra_nombre", access.obra_nombre).order("fecha_entrega", { ascending: false }).limit(40)).data || [];
      }
      if (p.prevencion) result.prevencion = (await supabase.from("prevencion_respuestas").select("id,formulario_id,inspector,created_at").eq("proyecto_nombre", access.obra_nombre).order("created_at", { ascending: false }).limit(40)).data || [];
      if (p.estados_pago) result.estados_pago = (await supabase.from("estados_pago_obra").select("id,numero,fecha_corte,monto_bruto,retencion_monto,anticipo_descontado,monto_neto,estado,factura_numero,factura_estado,factura_fecha_pago").eq("empresa", portal.empresa).eq("obra_nombre", access.obra_nombre).order("numero", { ascending: false })).data || [];
      if (p.libro_obra) result.libro_obra = (await supabase.from("libro_obra_digital").select("id,folio,fecha,tipo,asunto,detalle,emisor,destinatario,estado,respuesta,fecha_respuesta,flujo_estado").eq("empresa", portal.empresa).eq("obra_nombre", access.obra_nombre).order("folio", { ascending: false }).limit(40)).data || [];
      return result;
    }));
    const { data: branding } = await supabase.from("config_empresa").select("empresa,razon_social,logo_base64,color_primario,color_secundario").eq("empresa", portal.empresa).maybeSingle();
    await supabase.from("clientes_portales").update({ ultimo_acceso: new Date().toISOString() }).eq("id", portal.id);
    await supabase.from("clientes_portal_eventos").insert({ portal_id: portal.id, empresa: portal.empresa, accion: "Acceso al portal", actor: portal.contacto_nombre });
    return json({ portal: { cliente_nombre: portal.cliente_nombre, contacto_nombre: portal.contacto_nombre }, branding, obras });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Error inesperado" }, 500);
  }
});
