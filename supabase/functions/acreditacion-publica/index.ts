import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://www.obraxis.cl",
  "Access-Control-Allow-Headers": "authorization,content-type,x-client-info,apikey",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const out = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const clean = (value: unknown, max = 160) => String(value ?? "").trim().slice(0, max);
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return out({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return out({ error: "Servicio no configurado" }, 500);
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 12 * 1024 * 1024) return out({ error: "La carga supera el tamaño permitido" }, 413);
    const body = JSON.parse(rawBody);
    const tipo = clean(body?.tipo, 20);
    const action = clean(body?.action, 20);
    const token = clean(body?.token, 180);
    const clave = clean(body?.clave, 40).toUpperCase();
    if (!['subcontrato', 'proveedor'].includes(tipo) || token.length < 8 || !clave) return out({ error: "Credenciales requeridas" }, 401);
    if (!['ingresar', 'guardar'].includes(action)) return out({ error: "Acción inválida" }, 400);

    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const ip = clean(request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown', 80);
    const tokenHash = await digest(`${tipo}:${token}:${ip}`);
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await db.from('subcontrato_portal_intentos').select('id', { count: 'exact', head: true }).eq('token_hash', tokenHash).gte('created_at', since);
    if ((count || 0) >= 20) return out({ error: "Demasiadas solicitudes. Intenta nuevamente en un minuto." }, 429);
    await db.from('subcontrato_portal_intentos').insert({ token_hash: tokenHash });

    const table = tipo === 'subcontrato' ? 'acreditaciones_subcontratos' : 'acreditaciones_proveedores';
    const { data: entity } = await db.from(table).select('id,empresa,empresa_nombre,rut_empresa,obra_asociada,correo_contacto,estado,estado_cumplimiento,"companyDocs","personalList","equiposList",credencial_pass').eq('token_acceso', token).maybeSingle();
    if (!entity || entity.estado === 'Archivado' || clean(entity.credencial_pass, 40).toUpperCase() !== clave) return out({ error: "Credenciales inválidas" }, 403);

    if (action === 'guardar') {
      const companyDocs = body?.companyDocs && typeof body.companyDocs === 'object' && !Array.isArray(body.companyDocs) ? body.companyDocs : {};
      const personalList = Array.isArray(body?.personalList) ? body.personalList.slice(0, 1000) : [];
      const equiposList = Array.isArray(body?.equiposList) ? body.equiposList.slice(0, 1000) : [];
      const progress = Math.max(0, Math.min(100, Number(body?.progressPercent) || 0));
      const { error } = await db.from(table).update({ "companyDocs": companyDocs, "personalList": personalList, "equiposList": equiposList, estado_cumplimiento: progress, updated_at: new Date().toISOString() }).eq('id', entity.id).eq('empresa', entity.empresa);
      if (error) throw error;
      entity.companyDocs = companyDocs;
      entity.personalList = personalList;
      entity.equiposList = equiposList;
      entity.estado_cumplimiento = progress;
    }

    const { data: config } = await db.from('acreditaciones_config_docs').select('company_docs,worker_docs,equipo_docs,supplier_docs,supplier_worker_docs,supplier_equipo_docs').eq('empresa', entity.empresa).maybeSingle();
    const publicEntity = { ...entity } as Record<string, unknown>;
    delete publicEntity.credencial_pass;
    return out({ entidad: publicEntity, configuracion: config || null });
  } catch (error) {
    console.error(error);
    return out({ error: error instanceof Error ? error.message : "Error interno" }, 500);
  }
});
