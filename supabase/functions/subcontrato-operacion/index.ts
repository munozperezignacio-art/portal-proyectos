import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://www.obraxis.cl",
  "Access-Control-Allow-Headers": "content-type,x-client-info,apikey",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return out({ error: "Método no permitido" }, 405);
  try {
    const { token, credential, contractId, action, data = {} } = await req.json();
    if (!token || !credential) return out({ error: "Credenciales requeridas" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const raw = token + ":" + credential;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)))).map(b => b.toString(16).padStart(2, "0")).join("");
    const since = new Date(Date.now() - 60000).toISOString();
    const { count } = await db.from("subcontrato_portal_intentos").select("*", { count: "exact", head: true }).eq("token_hash", hash).gte("created_at", since);
    if ((count || 0) >= 20) return out({ error: "Demasiadas solicitudes. Intenta nuevamente en un minuto." }, 429);
    await db.from("subcontrato_portal_intentos").insert({ token_hash: hash });

    const { data: profile } = await db.from("subcontrato_operacion_perfiles").select("*").eq("token_acceso", token).eq("activo", true).maybeSingle();
    if (!profile || profile.clave_hash !== hash) return out({ error: "Credenciales operacionales inválidas" }, 403);
    const [{ data: subcontract }, { data: work }, { data: contracts }] = await Promise.all([
      db.from("acreditaciones_subcontratos").select("id,empresa_nombre,rut_empresa,estado").eq("id", profile.subcontratista_id).maybeSingle(),
      db.from("obras").select("id,nombre,empresa").eq("id", profile.obra_id).maybeSingle(),
      db.from("subcontrato_contratos").select("*").eq("subcontratista_id", profile.subcontratista_id).eq("obra_id", profile.obra_id).eq("estado", "Vigente").order("created_at")
    ]);
    if (!subcontract || subcontract.estado === "Archivado" || !work) return out({ error: "El acceso operacional no está disponible" }, 403);
    const contractRows = contracts || [];
    const contractIds = contractRows.map(row => row.id);
    const { data: allItems } = contractIds.length
      ? await db.from("subcontrato_contrato_items").select("*").in("contrato_id", contractIds).order("orden")
      : { data: [] };
    const enriched = contractRows.map(row => ({ ...row, items: (allItems || []).filter(item => item.contrato_id === row.id) }));

    if (action === "access") return out({ profile: { contacto_nombre: profile.contacto_nombre }, subcontract, work, contracts: enriched });
    const contract = contractRows.find(row => String(row.id) === String(contractId));
    if (!contract) return out({ error: "Selecciona un contrato vigente" }, 409);

    if (action === "list") {
      const [a, s, p] = await Promise.all([
        db.from("subcontrato_avances").select("id,fecha,estado,partida_nombre").eq("contrato_operativo_id", contract.id).limit(10),
        db.from("subcontrato_asistencia").select("id,fecha,estado,presentes").eq("contrato_operativo_id", contract.id).limit(10),
        db.from("subcontrato_estados_pago").select("id,created_at,estado,numero").eq("contrato_operativo_id", contract.id).limit(10)
      ]);
      return out({ records: [...(a.data || []).map(x => ({ ...x, tipo: "Avance" })), ...(s.data || []).map(x => ({ ...x, tipo: "Asistencia" })), ...(p.data || []).map(x => ({ ...x, tipo: "Estado de pago N° " + x.numero }))] });
    }

    const permissions: Record<string, boolean> = { create_avance: contract.reporta_avances, create_asistencia: contract.reporta_asistencia, create_pago: contract.reporta_estados_pago };
    if (!permissions[action]) return out({ error: "Este contrato no tiene habilitado ese tipo de reporte" }, 403);
    const common = { contrato_operativo_id: contract.id, subcontrato_id: subcontract.id, subcontrato_nombre: subcontract.empresa_nombre, empresa: work.empresa, obra_nombre: work.nombre };
    if (action === "create_avance") {
      const item = (allItems || []).find(row => String(row.id) === String(data.contrato_item_id) && row.contrato_id === contract.id && row.tipo_item === "Partida" && row.reporta_avance);
      if (!item) return out({ error: "Selecciona una partida habilitada en el contrato" }, 400);
      const { error } = await db.from("subcontrato_avances").insert({ ...common, contrato_item_id: item.id, fecha: data.fecha, partida_nombre: item.descripcion, cantidad: data.cantidad, unidad: item.unidad, comentario: data.comentario || null });
      return error ? out({ error: error.message }, 400) : out({ success: true });
    }
    if (action === "create_asistencia") {
      const { error } = await db.from("subcontrato_asistencia").insert({ ...common, fecha: data.fecha, presentes: data.presentes, ausentes: data.ausentes || 0, horas_hombre: data.horas_hombre || 0 });
      return error ? out({ error: error.message }, 400) : out({ success: true });
    }
    const { error } = await db.from("subcontrato_estados_pago").insert({ ...common, numero: data.numero, periodo_desde: data.periodo_desde, periodo_hasta: data.periodo_hasta, monto_presentado: data.monto_presentado, factura_folio: data.factura_folio || null, observaciones: data.observaciones || null });
    return error ? out({ error: error.message }, 400) : out({ success: true });
  } catch (error) {
    return out({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});

function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
