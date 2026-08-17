import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://obraxis.cl", "https://www.obraxis.cl"]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://www.obraxis.cl",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const reply = (body: unknown, status = 200, origin: string | null = null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
const clean = (value: unknown, max = 300) => String(value ?? "").trim().slice(0, max);
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((x) => x.toString(16).padStart(2, "0")).join("");
const rutKey = (value: unknown) => clean(value, 20).replace(/[^0-9kK]/g, "").toUpperCase();
const validRut = (value: unknown) => {
  const rut = rutKey(value);
  if (!/^\d{7,8}[0-9K]$/.test(rut)) return false;
  const body = rut.slice(0, -1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  const verifier = result === 11 ? "0" : result === 10 ? "K" : String(result);
  return verifier === rut.slice(-1);
};
const distance = (a: number, b: number, c: number, d: number) => {
  const radius = 6371000;
  const x = (c - a) * Math.PI / 180;
  const y = (d - b) * Math.PI / 180;
  const z = Math.sin(x / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(y / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(z), Math.sqrt(1 - z)));
};
const validSignature = (value: unknown) => {
  const signature = clean(value, 4 * 1024 * 1024);
  return signature.startsWith("data:image/png;base64,") && signature.length >= 250 ? signature : null;
};

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (request.method !== "POST") return reply({ error: "Método no permitido" }, 405, origin);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return reply({ error: "Servicio no configurado" }, 503, origin);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await request.json();
    const action = clean(body?.accion, 30);
    const token = clean(body?.token, 160);
    if (token.length < 32) return reply({ error: "Código QR inválido" }, 404, origin);

    const ip = clean(request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
    const [tokenHash, ipHash] = await Promise.all([digest(token), digest(ip)]);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await db.from("formulario_publico_intentos").select("id", { count: "exact", head: true }).eq("token_hash", tokenHash).eq("ip_hash", ipHash).eq("accion", `asis_${action}`).gte("created_at", since);
    if ((count || 0) >= (action === "marcar" ? 10 : 60)) return reply({ error: "Demasiados intentos. Intenta más tarde." }, 429, origin);
    const log = (successful: boolean) => db.from("formulario_publico_intentos").insert({ token_hash: tokenHash, ip_hash: ipHash, accion: `asis_${action}`, exitoso: successful });

    const { data: work } = await db.from("obras").select("id,nombre,tipo,empresa,latitud,longitud,radio_cobertura_m").eq("asistencia_token", token).maybeSingle();
    if (!work) {
      await log(false);
      return reply({ error: "La obra no está disponible" }, 404, origin);
    }
    if (action === "cargar") {
      await log(true);
      return reply({ obra: { id: work.id, nombre: work.nombre, tipo: work.tipo, latitud: work.latitud, longitud: work.longitud, radio_cobertura_m: work.radio_cobertura_m || 200 } }, 200, origin);
    }

    const rut = rutKey(body?.rut);
    if (!validRut(rut)) return reply({ error: "RUT inválido" }, 400, origin);
    const { data: workers } = await db.from("maestro_personal").select("nombre,rut,cargo").eq("empresa", work.empresa).eq("obra_nombre", work.nombre);
    const worker = (workers || []).find((item: { rut?: string }) => rutKey(item.rut) === rut);
    if (!worker) {
      await log(false);
      return reply({ error: "El trabajador no está asignado a esta obra" }, 404, origin);
    }
    if (action === "validar_persona") {
      await log(true);
      return reply({ trabajador: { nombre: worker.nombre, cargo: worker.cargo || "" } }, 200, origin);
    }
    if (action !== "marcar") return reply({ error: "Acción inválida" }, 400, origin);

    if (work.latitud == null || work.longitud == null) return reply({ error: "La obra no tiene configurada su ubicación GPS" }, 409, origin);
    const lat = Number(body?.latitud);
    const lng = Number(body?.longitud);
    const accuracy = Number(body?.precision_gps_m);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(accuracy) || accuracy <= 0) return reply({ error: "Debes habilitar una ubicación GPS válida" }, 400, origin);
    const allowedRadius = Number(work.radio_cobertura_m || 200);
    if (accuracy > Math.max(100, allowedRadius)) return reply({ error: `La precisión GPS es insuficiente (±${Math.round(accuracy)} m). Intenta nuevamente al aire libre.` }, 400, origin);
    const workDistance = distance(lat, lng, Number(work.latitud), Number(work.longitud));
    if (workDistance > allowedRadius) return reply({ error: `Marcación fuera del radio autorizado (${workDistance} m)` }, 403, origin);
    const signature = validSignature(body?.firma_base64);
    if (!signature) return reply({ error: "La firma manuscrita es obligatoria" }, 400, origin);

    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
    const localDate = `${part("year")}-${part("month")}-${part("day")}`;
    const { data: existing } = await db.from("asistencia_personal").select("id,ingreso,salida").eq("empresa", work.empresa).eq("obra_id", work.id).eq("rut_normalizado", rut).eq("fecha_marcacion", localDate).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const now = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    let type = "INGRESO";

    if (existing?.ingreso && existing?.salida) return reply({ error: "El ingreso y la salida de hoy ya fueron registrados" }, 409, origin);
    if (existing?.ingreso && !existing?.salida) {
      type = "SALIDA";
      const [entryHour, entryMinute] = String(existing.ingreso).split(":").map(Number);
      const [exitHour, exitMinute] = now.split(":").map(Number);
      const workedHours = Math.max(0, ((exitHour * 60 + exitMinute) - (entryHour * 60 + entryMinute)) / 60);
      const ordinaryHours = Math.min(9, Number(workedHours.toFixed(2)));
      const extraHours = Math.max(0, Number((workedHours - 9).toFixed(2)));
      const { error } = await db.from("asistencia_personal").update({
        salida: now,
        firma_salida_base64: signature,
        latitud_salida: lat,
        longitud_salida: lng,
        distancia_salida_obra_m: workDistance,
        precision_gps_salida_m: accuracy,
        horas_ordinarias: ordinaryHours,
        horas_extras_auto: extraHours,
        verificado_qr: true,
      }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await db.from("asistencia_personal").insert({
        empresa: work.empresa,
        obra_id: work.id,
        obra_nombre: work.nombre,
        fecha_marcacion: localDate,
        supervisor: "Autogestión QR Móvil",
        trabajador: worker.nombre,
        rut: clean(body?.rut, 20),
        rut_normalizado: rut,
        asistencia: "PRESENTE",
        ingreso: now,
        salida: null,
        colacion: "SI",
        horas_ordinarias: 0,
        firma_base64: signature,
        latitud: lat,
        longitud: lng,
        distancia_obra_m: workDistance,
        precision_gps_ingreso_m: accuracy,
        verificado_qr: true,
      });
      if (error) throw error;
    }
    await log(true);
    return reply({ ok: true, tipo: type, trabajador: worker.nombre, obra: work.nombre, hora: now }, 200, origin);
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : "Error inesperado" }, 500, origin);
  }
});
