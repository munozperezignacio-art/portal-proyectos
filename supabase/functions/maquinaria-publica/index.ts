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
    const body = await req.json();
    const action = clean(body?.action, 20), token = clean(body?.token, 160);
    if (token.length < 20) return reply({ error: "Enlace inválido." }, 404, origin);
    const ip = clean(req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
    const [tokenHash, ipHash] = await Promise.all([digest(token), digest(ip)]);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await db.from("formulario_publico_intentos").select("id", { count: "exact", head: true }).eq("token_hash", tokenHash).eq("ip_hash", ipHash).eq("accion", `maq_${action}`).gte("created_at", since);
    if ((count || 0) >= (action === "registrar" ? 12 : 80)) return reply({ error: "Demasiados intentos. Intenta nuevamente más tarde." }, 429, origin);
    const log = (success: boolean) => db.from("formulario_publico_intentos").insert({ token_hash: tokenHash, ip_hash: ipHash, accion: `maq_${action}`, exitoso: success });

    const { data: equipment } = await db.from("inventario_maquinaria").select("id,tipo,patente,marca,obra_nombre,horometro_inicial,empresa").eq("publico_token", token).maybeSingle();
    if (!equipment) { await log(false); return reply({ error: "Equipo no disponible." }, 404, origin); }
    const { data: lastUse } = await db.from("maquinaria_uso_diario").select("horometro_final,fecha").eq("empresa", equipment.empresa).eq("equipo_id", String(equipment.id)).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const currentReading = Number(lastUse?.horometro_final ?? equipment.horometro_inicial ?? 0);
    if (action === "cargar") { await log(true); return reply({ equipo: { ...equipment, horometro_inicial: currentReading } }, 200, origin); }
    if (action !== "registrar") return reply({ error: "Acción inválida." }, 400, origin);

    const initial = Number(body?.horometro_inicial), final = Number(body?.horometro_final);
    const fuel = Math.max(0, Number(body?.combustible_cargado) || 0);
    const date = clean(body?.fecha, 10), operator = clean(body?.operador, 180), notes = clean(body?.observaciones, 2000);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !operator || !Number.isFinite(initial) || !Number.isFinite(final)) return reply({ error: "Completa correctamente fecha, operador y lecturas." }, 400, origin);
    if (Math.abs(initial - currentReading) > .01) return reply({ error: `La lectura inicial vigente es ${currentReading}. Actualiza el formulario.` }, 409, origin);
    if (final < initial || final - initial > 5000) return reply({ error: "La lectura final no es válida." }, 400, origin);

    const { error: insertError } = await db.from("maquinaria_uso_diario").insert({
      equipo_id: String(equipment.id), equipo_tipo: equipment.tipo, equipo_patente: equipment.patente,
      obra_nombre: equipment.obra_nombre || "Sin asignar", fecha: date, horometro_inicial: initial,
      horometro_final: final, horas_trabajadas: Math.max(0, final - initial), combustible_cargado: fuel,
      operador: operator, observaciones: notes, empresa: equipment.empresa,
    });
    if (insertError) throw insertError;
    await db.from("inventario_maquinaria").update({ horometro_inicial: final }).eq("id", equipment.id).eq("empresa", equipment.empresa);
    await log(true); return reply({ ok: true, horas_trabajadas: Math.max(0, final - initial) }, 200, origin);
  } catch (error) {
    console.error(error); return reply({ error: error instanceof Error ? error.message : "Error inesperado." }, 500, origin);
  }
});
