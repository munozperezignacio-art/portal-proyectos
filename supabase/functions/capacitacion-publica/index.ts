import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const origins = new Set(["https://obraxis.cl", "https://www.obraxis.cl"]);
const cors = (origin: string | null) => ({ "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "https://www.obraxis.cl", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" });
const reply = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
const clean = (value: unknown, max = 250) => String(value ?? "").trim().slice(0, max);
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(x => x.toString(16).padStart(2, "0")).join("");
const grade = (score: number, max: number) => { if (!max) return 1; const pct = score / max; return Math.round((pct < .6 ? 1 + 3 * pct / .6 : 4 + 3 * (pct - .6) / .4) * 10) / 10; };

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
    if (token.length < 8) return reply({ error: "Enlace inválido." }, 404, origin);
    const ip = clean(req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
    const [tokenHash, ipHash] = await Promise.all([digest(token), digest(ip)]);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString(), event = `cap_${action}`;
    const { count } = await db.from("formulario_publico_intentos").select("id", { count: "exact", head: true }).eq("token_hash", tokenHash).eq("ip_hash", ipHash).eq("accion", event).gte("created_at", since);
    if ((count || 0) >= (action === "enviar" ? 8 : 60)) return reply({ error: "Demasiados intentos. Intenta nuevamente más tarde." }, 429, origin);
    const log = (ok: boolean) => db.from("formulario_publico_intentos").insert({ token_hash: tokenHash, ip_hash: ipHash, accion: event, exitoso: ok });
    const { data: training } = await db.from("prevencion_capacitaciones").select("id,titulo,descripcion,video_url,contenido_texto,preguntas,publico_token,empresa").eq("publico_token", token).maybeSingle();
    if (!training) { await log(false); return reply({ error: "La capacitación no existe o fue dada de baja." }, 404, origin); }
    const questions = Array.isArray(training.preguntas) ? training.preguntas : [];
    if (action === "cargar") {
      const publicQuestions = questions.map(({ correct_idx: _answer, ...question }: Record<string, unknown>) => question);
      await log(true); return reply({ capacitacion: { ...training, preguntas: publicQuestions } }, 200, origin);
    }
    if (action !== "enviar") return reply({ error: "Acción inválida." }, 400, origin);
    const name = clean(body?.nombre_trabajador, 180), rut = clean(body?.rut_trabajador, 20), answers = body?.respuestas;
    if (!name || !/^\d{1,2}(?:\.\d{3}){2}-[\dkK]$/.test(rut) || !answers || typeof answers !== "object" || Array.isArray(answers)) return reply({ error: "Nombre, RUT o respuestas inválidos." }, 400, origin);
    if (!questions.length || Object.keys(answers).length !== questions.length) return reply({ error: "Debes responder todas las preguntas." }, 400, origin);
    let score = 0, maximum = 0;
    questions.forEach((question: Record<string, unknown>, index: number) => { const points = Math.max(0, Number(question.puntos) || 1); maximum += points; if (Number(answers[index]) === Number(question.correct_idx)) score += points; });
    const finalGrade = grade(score, maximum), passed = finalGrade >= 4;
    const { error } = await db.from("prevencion_capacitaciones_intentos").insert({ capacitacion_id: training.id, empresa: training.empresa, nombre_trabajador: name, rut_trabajador: rut, respuestas: answers, puntaje_obtenido: score, puntaje_maximo: maximum, nota: finalGrade, aprobado: passed });
    if (error) throw error;
    await log(true); return reply({ resultado: { puntaje_obtenido: score, puntaje_maximo: maximum, nota: finalGrade, aprobado: passed } }, 200, origin);
  } catch (error) { console.error(error); return reply({ error: error instanceof Error ? error.message : "Error inesperado." }, 500, origin); }
});
