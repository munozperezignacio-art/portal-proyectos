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
    const { token, credential, action, data = {} } = await req.json();
    if (!token || !credential) return out({ error: "Credenciales requeridas" }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const raw = token + ":" + credential;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)))).map(b => b.toString(16).padStart(2, "0")).join("");
    const since = new Date(Date.now() - 60000).toISOString();
    const { count } = await db.from("subcontrato_portal_intentos").select("*", { count: "exact", head: true }).eq("token_hash", hash).gte("created_at", since);
    if ((count || 0) >= 20) return out({ error: "Demasiadas solicitudes. Intenta nuevamente en un minuto." }, 429);
    await db.from("subcontrato_portal_intentos").insert({ token_hash: hash });
    const { data: sub } = await db.from("acreditaciones_subcontratos").select("id,empresa_nombre,obra_asociada,estado,credencial_pass").eq("token_acceso", token).eq("credencial_pass", credential).single();
    if (!sub || sub.estado === "Archivado") return out({ error: "Credenciales inválidas" }, 403);
    const { data: obra } = await db.from("obras").select("empresa").eq("nombre", sub.obra_asociada).limit(1).maybeSingle();
    if (!obra?.empresa) return out({ error: "La obra asociada no está disponible" }, 409);
    const common = { subcontrato_id: sub.id, subcontrato_nombre: sub.empresa_nombre, empresa: obra.empresa, obra_nombre: sub.obra_asociada };
    if (action === "list") {
      const [a, s, p] = await Promise.all([
        db.from("subcontrato_avances").select("id,fecha,estado,partida_nombre").eq("subcontrato_id", sub.id).eq("obra_nombre", sub.obra_asociada).limit(10),
        db.from("subcontrato_asistencia").select("id,fecha,estado,presentes").eq("subcontrato_id", sub.id).eq("obra_nombre", sub.obra_asociada).limit(10),
        db.from("subcontrato_estados_pago").select("id,created_at,estado,numero").eq("subcontrato_id", sub.id).eq("obra_nombre", sub.obra_asociada).limit(10)
      ]);
      return out({ records: [...(a.data || []).map(x => ({ ...x, tipo: "Avance" })), ...(s.data || []).map(x => ({ ...x, tipo: "Asistencia" })), ...(p.data || []).map(x => ({ ...x, tipo: "Estado de pago N° " + x.numero }))] });
    }
    const map: Record<string, [string, string[]]> = {
      create_avance: ["subcontrato_avances", ["fecha", "partida_nombre", "cantidad", "unidad", "comentario"]],
      create_asistencia: ["subcontrato_asistencia", ["fecha", "presentes", "ausentes", "horas_hombre"]],
      create_pago: ["subcontrato_estados_pago", ["numero", "periodo_desde", "periodo_hasta", "monto_presentado", "factura_folio", "observaciones"]]
    };
    const cfg = map[action];
    if (!cfg) return out({ error: "Acción inválida" }, 400);
    const payload: Record<string, unknown> = { ...common };
    for (const key of cfg[1]) if (data[key] !== undefined && data[key] !== "") payload[key] = data[key];
    const { error } = await db.from(cfg[0]).insert(payload);
    return error ? out({ error: error.message }, 400) : out({ success: true });
  } catch (error) {
    return out({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});

function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
