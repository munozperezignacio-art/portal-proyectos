import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const num = (value: unknown) => Number(value || 0);
const normalized = (value: unknown) => String(value || "").trim().toLocaleLowerCase("es-CL");
const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;
const isClosed = (value: unknown) => ["cerrada", "cerrado", "resuelta", "resuelto", "aprobada", "aprobado"].includes(normalized(value));

const schema = {
  type: "object", additionalProperties: false,
  properties: {
    respuesta_breve: { type: "string" },
    hechos: { type: "array", items: { type: "object", additionalProperties: false, properties: { texto: { type: "string" }, fuente_id: { type: "string" } }, required: ["texto", "fuente_id"] } },
    calculos: { type: "array", items: { type: "object", additionalProperties: false, properties: { nombre: { type: "string" }, valor: { type: "string" }, base: { type: "string" } }, required: ["nombre", "valor", "base"] } },
    sugerencias: { type: "array", items: { type: "object", additionalProperties: false, properties: { accion: { type: "string" }, prioridad: { type: "string", enum: ["Alta", "Media", "Baja"] }, motivo: { type: "string" } }, required: ["accion", "prioridad", "motivo"] } },
    limitaciones: { type: "array", items: { type: "string" } }
  },
  required: ["respuesta_breve", "hechos", "calculos", "sugerencias", "limitaciones"]
};

const hasWorksiteAccess = (profile: any, worksite: string) => {
  if (normalized(profile?.empresa) === "obraxis" && normalized(profile?.rol).includes("superusuario")) return true;
  const raw = String(profile?.obras || "").trim();
  if (!raw) return false;
  if (["todas", "todos", "*"].includes(normalized(raw))) return true;
  let values: string[] = [];
  try { const parsed = JSON.parse(raw); values = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)]; }
  catch { values = raw.split(/[,;|]/); }
  return values.some(value => normalized(value) === normalized(worksite));
};

type Source = { id: string; modulo: string; referencia: string; destino: string; registro_id?: string | number | null };
type Context = { obra: any; resumen: any; partidas: any[]; costos_por_tipo: any[]; calidad: any[]; prevencion: any[]; estados_pago: any[]; fuentes: Source[] };

const decorate = (result: any, sources: Source[], mode: "IA" | "Determinístico") => {
  const allowed = new Map(sources.map(source => [source.id, source]));
  const hechos = (Array.isArray(result?.hechos) ? result.hechos : []).flatMap((fact: any) => {
    const source = allowed.get(String(fact?.fuente_id || ""));
    if (!source) return [];
    return [{ texto: String(fact.texto || ""), fuente_id: source.id, modulo: source.modulo, referencia: source.referencia, destino: source.destino, registro_id: source.registro_id ?? null }];
  });
  return { respuesta_breve: String(result?.respuesta_breve || ""), hechos, calculos: Array.isArray(result?.calculos) ? result.calculos : [], sugerencias: Array.isArray(result?.sugerencias) ? result.sugerencias : [], limitaciones: Array.isArray(result?.limitaciones) ? result.limitaciones : [], meta: { modo: mode, generado_con_ia: mode === "IA" } };
};

const deterministicAnswer = (question: string, context: Context) => {
  const q = normalized(question);
  if ((q.includes("menor avance") || q.includes("mayor atraso") || q.includes("más atras") || q.includes("mas atras")) && q.includes("partida")) {
    const ranked = context.partidas.filter(row => row.avance_pct !== null).sort((a, b) => a.avance_pct - b.avance_pct).slice(0, 5);
    return {
      respuesta_breve: ranked.length ? `Las ${ranked.length} partidas con menor avance registrado están ordenadas de menor a mayor.` : "No existen partidas con cantidad programada y avance calculable.",
      hechos: ranked.map(row => ({ texto: `${row.partida}: ${row.avance_pct.toFixed(1)}% (${row.reportado.toLocaleString("es-CL")} de ${row.programado.toLocaleString("es-CL")} ${row.unidad || ""}).`, fuente_id: row.fuente_id })),
      calculos: [{ nombre: "Partidas evaluadas", valor: String(context.partidas.filter(row => row.avance_pct !== null).length), base: "Cantidad reportada acumulada / cantidad presupuestada" }],
      sugerencias: ranked.length ? [{ accion: "Revisar programación, restricciones y recursos de las partidas listadas.", prioridad: "Alta", motivo: "Son las partidas con menor avance físico acumulado disponible." }] : [],
      limitaciones: ["Este orden usa avance acumulado; no equivale por sí solo a atraso contractual sin comparar la programación al corte."]
    };
  }
  if (q.includes("calidad") && (q.includes("prevenci") || q.includes("seguridad"))) {
    return {
      respuesta_breve: `La obra registra ${context.resumen.no_conformidades_abiertas} no conformidad(es) abierta(s) y ${context.resumen.registros_prevencion} registro(s) preventivo(s).`,
      hechos: [{ texto: `${context.resumen.no_conformidades_abiertas} no conformidad(es) permanecen abiertas.`, fuente_id: "calidad:resumen" }, { texto: `${context.resumen.registros_prevencion} registro(s) preventivo(s) están asociados a la obra.`, fuente_id: "prevencion:resumen" }],
      calculos: [], sugerencias: context.resumen.no_conformidades_abiertas ? [{ accion: "Priorizar no conformidades vencidas o de mayor clasificación.", prioridad: "Alta", motivo: "El cierre debe mantener causa, acción y verificación trazables." }] : [],
      limitaciones: ["La cantidad de registros preventivos no representa por sí sola cumplimiento ni accidentabilidad."]
    };
  }
  if (q.includes("estado") && q.includes("pago")) {
    const pending = context.estados_pago.filter(item => !isClosed(item.estado)).length;
    return { respuesta_breve: `Existen ${context.estados_pago.length} estado(s) de pago y ${pending} permanece(n) en flujo.`, hechos: [{ texto: `${pending} estado(s) de pago no tienen estado final.`, fuente_id: "estados_pago:resumen" }], calculos: [{ nombre: "Estados de pago en flujo", valor: String(pending), base: "Estados distintos de cerrado, resuelto o aprobado" }], sugerencias: pending ? [{ accion: "Revisar los estados de pago pendientes y su trazabilidad.", prioridad: "Media", motivo: "Mantienen acciones contractuales abiertas." }] : [], limitaciones: [] };
  }
  if (q.includes("costo") && (q.includes("total") || q.includes("gast") || q.includes("desviaci"))) {
    return { respuesta_breve: `El costo real registrado de la obra es ${money(context.resumen.costo_real_total)}.`, hechos: [{ texto: `Costo real acumulado: ${money(context.resumen.costo_real_total)}.`, fuente_id: "costos:resumen" }], calculos: context.costos_por_tipo.slice(0, 8).map(item => ({ nombre: item.tipo, valor: money(item.monto), base: "Suma de costos reales registrados en la categoría" })), sugerencias: [], limitaciones: ["La desviación requiere comparar este costo con presupuesto, valor ganado y fecha de corte."] };
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now(); let reservationId: string | undefined; let db: any;
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) return json({ error: "El Copiloto no está configurado en el servidor." }, 503);
    db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: "Debes iniciar sesión." }, 401);
    const body = await req.json();
    const empresa = String(body?.empresa || "").trim(), obraNombre = String(body?.obra_nombre || "").trim(), pregunta = String(body?.pregunta || "").trim();
    if (!empresa || !obraNombre || pregunta.length < 4) return json({ error: "Selecciona una obra y escribe una consulta válida." }, 400);
    if (pregunta.length > 1000) return json({ error: "La consulta supera el máximo de 1.000 caracteres." }, 400);
    const { data: profile } = await db.from("usuarios").select("usuario,nombre,correo,empresa,rol,rol_base,obras,modulos").eq("auth_user_id", authData.user.id).maybeSingle();
    if (!profile || normalized(profile.empresa) !== normalized(empresa)) return json({ error: "Cuenta no autorizada para esta empresa." }, 403);
    if (!hasWorksiteAccess(profile, obraNombre)) return json({ error: "No tienes acceso autorizado a esta obra." }, 403);
    const { data: worksite } = await db.from("obras").select("id,nombre,empresa,estado,tipo,cliente").eq("nombre", obraNombre).eq("empresa", empresa).maybeSingle();
    if (!worksite) return json({ error: "La obra no existe o no pertenece a la empresa indicada." }, 404);
    const { count: sameNameCount } = await db.from("obras").select("id", { count: "exact", head: true }).eq("nombre", obraNombre);
    if (num(sameNameCount) > 1) return json({ error: "Esta obra comparte nombre con otra empresa. Para proteger el aislamiento de datos, asígnale un nombre único antes de consultar el Copiloto." }, 409);

    const [partsResult, advancesResult, costsResult, qualityResult, safetyResult, paymentsResult] = await Promise.all([
      db.from("partidas_obra").select("id,partida,unidad,cantidad_presupuestada,costo_por_dia,fecha_inicio,fecha_termino").eq("obra_nombre", obraNombre),
      db.from("avances_produccion_partidas").select("id,partida,cantidad,created_at").eq("obra_nombre", obraNombre),
      db.from("costos_reales_obra").select("id,nombre,tipo_costo,monto,created_at").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("calidad_no_conformidades").select("id,codigo,partida,clasificacion,estado,fecha_compromiso").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("prevencion_respuestas").select("id,created_at").eq("proyecto_nombre", obraNombre),
      db.from("estados_pago_obra").select("id,numero,fecha_corte,monto_bruto,monto_neto,estado,factura_estado").eq("obra_nombre", obraNombre).eq("empresa", empresa)
    ]);
    const parts = partsResult.data || [], advances = advancesResult.data || [], costs = costsResult.data || [], quality = qualityResult.data || [], prevention = safetyResult.data || [], payments = paymentsResult.data || [];
    const progressByPart = new Map<string, number>(); advances.forEach((row: any) => progressByPart.set(row.partida, num(progressByPart.get(row.partida)) + num(row.cantidad)));
    const activities = parts.filter((row: any) => !["TITULO", "GRUPO"].includes(String(row.unidad || "").toUpperCase()));
    const activitySummaries = activities.map((row: any) => { const reported = num(progressByPart.get(row.partida)), planned = num(row.cantidad_presupuestada); return { id: row.id, fuente_id: `avance:${row.id}`, partida: row.partida, unidad: row.unidad, programado: planned, reportado: reported, avance_pct: planned > 0 ? Math.min(100, reported / planned * 100) : null, fecha_inicio: row.fecha_inicio, fecha_termino: row.fecha_termino }; }).sort((a: any, b: any) => (a.avance_pct ?? 101) - (b.avance_pct ?? 101)).slice(0, 40);
    const costByType = Object.entries(costs.reduce((acc: any, row: any) => { const key = row.tipo_costo || "Sin categoría"; acc[key] = num(acc[key]) + num(row.monto); return acc; }, {})).map(([tipo, monto]) => ({ tipo, monto }));
    const sources: Source[] = [
      { id: "obra:resumen", modulo: "Obra", referencia: obraNombre, destino: "inicio" },
      { id: "costos:resumen", modulo: "Control de costos", referencia: "Costos reales de la obra", destino: "estadisticas:costos" },
      { id: "calidad:resumen", modulo: "Calidad", referencia: "No conformidades de la obra", destino: "calidad" },
      { id: "prevencion:resumen", modulo: "Prevención", referencia: "Registros e inspecciones", destino: "prevencion" },
      { id: "estados_pago:resumen", modulo: "Estados de pago", referencia: "Historial contractual", destino: "estados_pago" },
      ...activitySummaries.map((row: any) => ({ id: row.fuente_id, modulo: "Programación y Avances", referencia: row.partida, destino: "estadisticas:avance", registro_id: row.id })),
      ...quality.slice(0, 30).map((row: any) => ({ id: `calidad:${row.id}`, modulo: "Calidad", referencia: `${row.codigo || "NC"} · ${row.partida || "Sin partida"}`, destino: "calidad", registro_id: row.id })),
      ...prevention.slice(0, 30).map((row: any) => ({ id: `prevencion:${row.id}`, modulo: "Prevención", referencia: `Registro ${row.id}`, destino: "prevencion", registro_id: row.id })),
      ...payments.slice(0, 30).map((row: any) => ({ id: `estado_pago:${row.id}`, modulo: "Estados de pago", referencia: `Estado de pago N° ${row.numero}`, destino: "estados_pago", registro_id: row.id }))
    ];
    const context: Context = {
      obra: { nombre: worksite.nombre, estado: worksite.estado, tipo: worksite.tipo },
      resumen: { partidas_activas: activities.length, reportes_avance: advances.length, costo_real_total: costs.reduce((sum: number, row: any) => sum + num(row.monto), 0), no_conformidades_abiertas: quality.filter((row: any) => !isClosed(row.estado)).length, registros_prevencion: prevention.length, estados_pago: payments.length },
      partidas: activitySummaries, costos_por_tipo: costByType, calidad: quality.slice(0, 25).map((row: any) => ({ ...row, fuente_id: `calidad:${row.id}` })), prevencion: prevention.slice(0, 25).map((row: any) => ({ ...row, fuente_id: `prevencion:${row.id}` })), estados_pago: payments.slice(0, 20).map((row: any) => ({ ...row, fuente_id: `estado_pago:${row.id}` })), fuentes: sources
    };

    const deterministic = deterministicAnswer(pregunta, context);
    if (deterministic) {
      const result = decorate(deterministic, sources, "Determinístico");
      const { data: history } = await db.from("copiloto_obra_consultas").insert({ empresa, obra_nombre: obraNombre, auth_user_id: authData.user.id, usuario: profile.nombre || profile.usuario || profile.correo, pregunta, respuesta: result, ia_consumo_id: null }).select("id,created_at").single();
      return json({ data: result, consulta: history, ia_consumo_id: null, usage: { tokens_total: 0, costo_usd: 0 } });
    }

    const [{ data: globalConfig }, { data: companyConfig }] = await Promise.all([db.from("config_global_obraxis").select("ia_habilitada,ia_modelo").eq("id", 1).maybeSingle(), db.from("ia_config_empresas").select("*").eq("empresa", empresa).maybeSingle()]);
    if (globalConfig?.ia_habilitada === false || companyConfig?.habilitada !== true) return json({ error: "La IA está deshabilitada. Puedes usar las consultas rápidas determinísticas disponibles." }, 403);
    if (companyConfig?.funciones?.copiloto !== true) return json({ error: "El Copiloto por obra no está contratado o habilitado." }, 403);
    const allowedRoles = companyConfig?.limites_funcion?.copiloto?.roles_autorizados || [];
    if (allowedRoles.length && !allowedRoles.some((role: string) => normalized(role) === normalized(profile.rol))) return json({ error: "Tu rol no está autorizado para usar el Copiloto." }, 403);
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) return json({ error: "La IA del Copiloto no está configurada en el servidor." }, 503);
    const model = companyConfig?.modelo || globalConfig?.ia_modelo || "gpt-4.1-mini";
    const { data: reserved, error: reserveError } = await db.rpc("ia_reservar_consumo", { p_empresa: empresa, p_obra_nombre: obraNombre, p_auth_user_id: authData.user.id, p_usuario: profile.nombre || profile.usuario || profile.correo, p_funcion: "copiloto", p_modelo: model, p_reserva_usd: .02 });
    if (reserveError) return json({ error: reserveError.message }, 429);
    reservationId = reserved;
    const prompt = `Eres el Copiloto de Obraxis para control profesional de construcción. Responde SOLO con el contexto JSON de la obra autorizada. No inventes ni completes datos ausentes. Distingue hechos, cálculos y sugerencias. Para cada hecho usa exclusivamente un fuente_id existente en contexto.fuentes. Si no existe una fuente que respalde una afirmación, omítela o indícala como limitación. Sé breve. No ordenes cambios ni afirmes que modificaste registros: eres de solo lectura. Consulta: ${pregunta}`;
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${openAIKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_text", text: JSON.stringify(context) }] }], text: { format: { type: "json_schema", name: "copiloto_contextual_obra", strict: true, schema } } }) });
    const apiData = await response.json();
    if (!response.ok) throw new Error(apiData?.error?.message || "No fue posible consultar el Copiloto.");
    const raw = apiData.output_text || apiData.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
    if (!raw) throw new Error("El Copiloto no devolvió una respuesta utilizable.");
    const result = decorate(JSON.parse(raw), sources, "IA"), inputTokens = num(apiData.usage?.input_tokens), outputTokens = num(apiData.usage?.output_tokens), cost = (inputTokens * .40 + outputTokens * 1.60) / 1_000_000;
    await db.rpc("ia_finalizar_consumo", { p_id: reservationId, p_estado: "Completado", p_tokens_entrada: inputTokens, p_tokens_salida: outputTokens, p_costo_usd: cost, p_confianza: null, p_duracion_ms: Date.now() - started, p_error_detalle: "", p_metadatos: { obra_nombre: obraNombre, fuentes: result.hechos.map((item: any) => item.fuente_id) } });
    const { data: history } = await db.from("copiloto_obra_consultas").insert({ empresa, obra_nombre: obraNombre, auth_user_id: authData.user.id, usuario: profile.nombre || profile.usuario || profile.correo, pregunta, respuesta: result, ia_consumo_id: reservationId }).select("id,created_at").single();
    return json({ data: result, consulta: history, ia_consumo_id: reservationId, usage: { tokens_total: inputTokens + outputTokens, costo_usd: cost } });
  } catch (error) {
    if (reservationId && db) await db.rpc("ia_finalizar_consumo", { p_id: reservationId, p_estado: "Error", p_tokens_entrada: 0, p_tokens_salida: 0, p_costo_usd: 0, p_confianza: null, p_duracion_ms: Date.now() - started, p_error_detalle: error instanceof Error ? error.message : String(error), p_metadatos: {} });
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
