import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://obraxis.cl", "https://www.obraxis.cl"]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://www.obraxis.cl",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin",
});
const reply = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
const clean = (value: unknown, max = 300) => String(value ?? "").trim().slice(0, max);
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return reply({ error: "Método no permitido." }, 405, origin);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return reply({ error: "Servicio no configurado." }, 503, origin);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
  try {
    const raw = await req.text();
    if (raw.length > 20000) return reply({ error: 'Formulario demasiado extenso.' }, 400, origin);
    const body = JSON.parse(raw);
    const action = clean(body?.action, 20), token = clean(body?.token, 160);
    if (!/^[a-f0-9]{48}$/.test(token) || !['cargar','registrar'].includes(action)) return reply({ error: "Enlace inválido." }, 404, origin);
    const ip = clean(req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
    const [tokenHash, ipHash] = await Promise.all([digest(token), digest(ip)]);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const auditAction = action === 'registrar' ? 'enviar' : 'cargar';
    const { count, error: rateError } = await db.from("formulario_publico_intentos").select("id", { count: "exact", head: true }).eq("token_hash", tokenHash).eq("accion", auditAction).gte("created_at", since);
    if (rateError) return reply({ error: 'Control de acceso no disponible.' }, 503, origin);
    if ((count || 0) >= (action === "registrar" ? 12 : 80)) return reply({ error: "Demasiados intentos. Intenta nuevamente más tarde." }, 429, origin);
    const log = (success: boolean) => db.from("formulario_publico_intentos").insert({ token_hash: tokenHash, ip_hash: ipHash, accion: auditAction, exitoso: success });
    const attempt = await log(false).select('id').single();
    if (attempt.error) return reply({ error: 'Control de acceso no disponible.' }, 503, origin);

    const { data: equipment } = await db.from("inventario_maquinaria").select("id,tipo,patente,marca,obra_nombre,horometro_inicial,empresa").eq("publico_token", token).maybeSingle();
    if (!equipment) return reply({ error: "Equipo no disponible." }, 404, origin);
    const [config, equipmentConfig] = await Promise.all([
      db.from('maquinaria_reporte_config').select('codigo,revision').eq('empresa',equipment.empresa).maybeSingle(),
      db.from('maquinaria_reporte_equipo').select('unidad,qr_activo').eq('equipo_id',equipment.id).eq('empresa',equipment.empresa).maybeSingle(),
    ]);
    if(config.error || equipmentConfig.error) return reply({error:'Configuración no disponible.'},503,origin);
    if(equipmentConfig.data?.qr_activo === false) return reply({error:'Este QR fue desactivado.'},404,origin);
    if (action === "cargar") {
      await db.from('formulario_publico_intentos').update({exitoso:true}).eq('id',attempt.data.id);
      return reply({ equipo: { tipo:equipment.tipo,patente:equipment.patente,marca:equipment.marca,empresa:equipment.empresa,obra_nombre:equipment.obra_nombre,
      horometro_inicial:equipment.horometro_inicial??0,unidad:equipmentConfig.data?.unidad||'h',codigo:config.data?.codigo||'MAQ-01',revision:config.data?.revision||'01' } },200,origin);
    }
    if (action !== "registrar") return reply({ error: "Acción inválida." }, 400, origin);

    if (!/^[0-9a-f-]{36}$/i.test(String(body.solicitud_id || ''))) return reply({error:'Actualiza el formulario antes de enviar.'},400,origin);
    const { data, error: saveError } = await db.rpc('registrar_reporte_maquinaria', {p_equipo_id:equipment.id,p_datos:body,p_solicitud:body.solicitud_id});
    if(saveError?.message==='MAQUINARIA_DESTINO_REQUERIDO') return reply({error:'El responsable debe resolver el destino del cargo diario en el portal. No se guardó el reporte.'},409,origin);
    if(saveError) return reply({error:saveError.code==='P0001'?saveError.message:'Revisa los datos. No se pudo guardar.'},400,origin);
    await db.from('formulario_publico_intentos').update({exitoso:true}).eq('id',attempt.data.id);
    return reply({ok:true,id:data.id},200,origin);
  } catch (error) {
    console.error(error); return reply({ error: error instanceof Error ? error.message : "Error inesperado." }, 500, origin);
  }
});
