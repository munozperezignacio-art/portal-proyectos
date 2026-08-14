import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const num = (value: unknown) => Number(value || 0);
const normalized = (value: unknown) => String(value || "").trim().toLocaleLowerCase("es-CL");
const money = (value: number) => `$${Math.round(value).toLocaleString("es-CL")}`;
const isClosed = (value: unknown) => ["cerrada", "cerrado", "resuelta", "resuelto", "aprobada", "aprobado"].includes(normalized(value));
const specializedIntent = (question: string) => {
  const q = normalized(question);
  if (["last planner", "lookahead", "restric", "recuper", "planific"].some(term => q.includes(term))) return "asistencia_planificacion";
  if (["calidad", "no conformidad", "protocolo", "causa raiz"].some(term => q.includes(term))) return "asistencia_calidad";
  if (["prevenci", "seguridad", "incidente", "accidente", "ast", "riesgo"].some(term => q.includes(term))) return "asistencia_prevencion";
  if (["maquinaria", "equipo", "mantenci", "falla", "horometro", "kilometraje"].some(term => q.includes(term))) return "asistencia_maquinaria";
  if (["personal", "persona", "dotaci", "rrhh", "recurso humano", "asistencia", "turno"].some(term => q.includes(term))) return "asistencia_rrhh";
  return "";
};

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
type Context = { obra: any; resumen: any; partidas: any[]; costos_por_tipo: any[]; calidad: any[]; prevencion: any[]; estados_pago: any[]; restricciones: any[]; maquinaria: any[]; fallas_maquinaria: any[]; personal_asignado: any[]; fuentes: Source[] };

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
  if (["analiza", "explica", "propone", "recomienda", "sugiere", "recurr", "causa", "escenario", "recuperacion", "recuperación", "borrador"].some(term => q.includes(term))) return null;
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
  if (q.includes("restric") || q.includes("last planner") || q.includes("partidas prontas")) {
    const pending = context.restricciones.filter(item => !["confirmado", "liberado", "no aplica", "no_aplica"].includes(normalized(item.estado)));
    const overdue = pending.filter(item => item.fecha_compromiso && item.fecha_compromiso < new Date().toISOString().slice(0, 10));
    const critical = pending.filter(item => ["crítica", "critica"].includes(normalized(item.criticidad)));
    return {
      respuesta_breve: `Existen ${pending.length} restricción(es) pendiente(s): ${overdue.length} vencida(s) y ${critical.length} crítica(s).`,
      hechos: pending.slice(0, 8).map(item => ({ texto: `${item.partida}: ${item.recurso || item.tipo || "restricción"} · ${item.estado || "Pendiente"}${item.fecha_compromiso ? ` · compromiso ${item.fecha_compromiso}` : ""}.`, fuente_id: item.fuente_id })),
      calculos: [{ nombre: "Restricciones pendientes", valor: String(pending.length), base: "Recursos Last Planner sin estado liberado, confirmado o no aplica" }, { nombre: "Restricciones vencidas", valor: String(overdue.length), base: "Fecha de compromiso anterior a hoy" }],
      sugerencias: overdue.length ? [{ accion: "Regularizar primero las restricciones vencidas y críticas antes de comprometer nuevas partidas.", prioridad: "Alta", motivo: "Pueden impedir el inicio o continuidad de actividades." }] : [],
      limitaciones: ["La liberación debe ser confirmada por el responsable; el Copiloto no modifica estados."]
    };
  }
  if (q.includes("maquinaria") || q.includes("equipo") || q.includes("mantenci") || q.includes("falla")) {
    const unavailable = context.maquinaria.filter(item => !["operativo", "disponible", "activo"].includes(normalized(item.estado_equipo)));
    const stopped = context.fallas_maquinaria.filter(item => item.detuvo_equipo && !item.solucion);
    const hours = context.maquinaria.reduce((sum, item) => sum + num(item.horas_reportadas), 0);
    return {
      respuesta_breve: `La obra tiene ${context.maquinaria.length} equipo(s) asignado(s), ${unavailable.length} fuera de condición operativa y ${stopped.length} falla(s) sin solución registrada.`,
      hechos: [...unavailable.slice(0, 5).map(item => ({ texto: `${item.tipo || "Equipo"} ${item.patente || "sin patente"}: estado ${item.estado_equipo || "no informado"}.`, fuente_id: item.fuente_id })), ...stopped.slice(0, 5).map(item => ({ texto: `${item.equipo_tipo || "Equipo"} ${item.equipo_patente || ""}: falla ${item.severidad || "sin severidad"} del ${item.fecha || "día no informado"}.`, fuente_id: item.fuente_id }))],
      calculos: [{ nombre: "Equipos asignados", valor: String(context.maquinaria.length), base: "Inventario asociado a la obra" }, { nombre: "Horas registradas", valor: hours.toLocaleString("es-CL"), base: "Suma de reportes diarios de uso disponibles" }],
      sugerencias: stopped.length ? [{ accion: "Resolver o documentar las fallas que mantienen equipos detenidos.", prioridad: "Alta", motivo: "Afectan disponibilidad y continuidad operacional." }] : [],
      limitaciones: ["La predicción de mantención requiere lecturas y planes de mantenimiento vigentes."]
    };
  }
  if (q.includes("persona") || q.includes("personal") || q.includes("dotaci") || q.includes("rrhh") || q.includes("recurso humano")) {
    const today = new Date().toISOString().slice(0, 10);
    const active = context.personal_asignado.filter(item => (!item.fecha_inicio || item.fecha_inicio <= today) && (!item.fecha_termino || item.fecha_termino >= today));
    const byRole = Object.entries(active.reduce((acc: Record<string, number>, item: any) => { const key = item.cargo || "Sin cargo"; acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a: any, b: any) => b[1] - a[1]);
    return {
      respuesta_breve: `La obra registra ${active.length} persona(s) con asignación vigente.`,
      hechos: active.slice(0, 8).map(item => ({ texto: `${item.trabajador_nombre}: ${item.cargo || "Sin cargo"}${item.fecha_termino ? ` · asignado hasta ${item.fecha_termino}` : ""}.`, fuente_id: item.fuente_id })),
      calculos: byRole.slice(0, 8).map(([cargo, total]) => ({ nombre: String(cargo), valor: String(total), base: "Asignaciones vigentes a la obra" })),
      sugerencias: [],
      limitaciones: ["La asignación contractual no confirma asistencia efectiva del día; para ello debe revisarse el registro de asistencia."]
    };
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

    const [partsResult, advancesResult, costsResult, qualityResult, safetyResult, paymentsResult, restrictionsResult, machineryResult, machineryUseResult, failuresResult, assignmentsResult] = await Promise.all([
      db.from("partidas_obra").select("id,partida,unidad,cantidad_presupuestada,costo_por_dia,fecha_inicio,fecha_termino").eq("obra_nombre", obraNombre),
      db.from("avances_produccion_partidas").select("id,partida,cantidad,created_at").eq("obra_nombre", obraNombre),
      db.from("costos_reales_obra").select("id,nombre,tipo_costo,monto,created_at").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("calidad_no_conformidades").select("id,codigo,partida,descripcion,clasificacion,estado,fecha_compromiso,origen,impacto,correccion_inmediata,metodo_causa_raiz,causa_categoria,causa_raiz,accion_correctiva,eficacia_verificada,observacion_verificacion").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("prevencion_respuestas").select("id,created_at,respuestas").eq("proyecto_nombre", obraNombre),
      db.from("estados_pago_obra").select("id,numero,fecha_corte,monto_bruto,monto_neto,estado,factura_estado").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("last_planner_recursos").select("id,partida,recurso,tipo,unidad,cantidad_requerida,estado,responsable,fecha_compromiso,criticidad,observacion").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("inventario_maquinaria").select("id,tipo,patente,marca,estado_equipo,horometro_inicial,planes_mantencion").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("maquinaria_uso_diario").select("id,equipo_id,horas_trabajadas,fecha").eq("obra_nombre", obraNombre).eq("empresa", empresa),
      db.from("maquinaria_fallas").select("id,equipo_id,equipo_patente,equipo_tipo,fecha,severidad,detuvo_equipo,horas_fuera_servicio,descripcion,causa,solucion").eq("empresa", empresa),
      db.from("rrhh_asignaciones_personal").select("id,trabajador_id,trabajador_nombre,cargo,fecha_inicio,fecha_termino").eq("obra_nombre", obraNombre).eq("empresa", empresa)
    ]);
    const parts = partsResult.data || [], advances = advancesResult.data || [], costs = costsResult.data || [], quality = qualityResult.data || [], prevention = safetyResult.data || [], payments = paymentsResult.data || [], restrictions = restrictionsResult.data || [], machinery = machineryResult.data || [], machineryUse = machineryUseResult.data || [], assignments = assignmentsResult.data || [];
    const machineryIds = new Set(machinery.map((item: any) => String(item.id)));
    const failures = (failuresResult.data || []).filter((item: any) => machineryIds.has(String(item.equipo_id)));
    const useByEquipment = machineryUse.reduce((acc: Record<string, number>, item: any) => { const key = String(item.equipo_id); acc[key] = (acc[key] || 0) + num(item.horas_trabajadas); return acc; }, {});
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
      { id: "restricciones:resumen", modulo: "Last Planner", referencia: "Restricciones y recursos", destino: "planificacion" },
      { id: "maquinaria:resumen", modulo: "Maquinaria", referencia: "Equipos asignados a la obra", destino: "maquinaria" },
      { id: "personal:resumen", modulo: "Recursos Humanos", referencia: "Personal asignado a la obra", destino: "personal" },
      ...activitySummaries.map((row: any) => ({ id: row.fuente_id, modulo: "Programación y Avances", referencia: row.partida, destino: "estadisticas:avance", registro_id: row.id })),
      ...quality.slice(0, 30).map((row: any) => ({ id: `calidad:${row.id}`, modulo: "Calidad", referencia: `${row.codigo || "NC"} · ${row.partida || "Sin partida"}`, destino: "calidad", registro_id: row.id })),
      ...prevention.slice(0, 30).map((row: any) => ({ id: `prevencion:${row.id}`, modulo: "Prevención", referencia: `Registro ${row.id}`, destino: "prevencion", registro_id: row.id })),
      ...payments.slice(0, 30).map((row: any) => ({ id: `estado_pago:${row.id}`, modulo: "Estados de pago", referencia: `Estado de pago N° ${row.numero}`, destino: "estados_pago", registro_id: row.id })),
      ...restrictions.slice(0, 40).map((row: any) => ({ id: `restriccion:${row.id}`, modulo: "Last Planner", referencia: `${row.partida} · ${row.recurso || row.tipo || "Restricción"}`, destino: "planificacion", registro_id: row.id })),
      ...machinery.slice(0, 40).map((row: any) => ({ id: `maquinaria:${row.id}`, modulo: "Maquinaria", referencia: `${row.tipo || "Equipo"} · ${row.patente || "Sin patente"}`, destino: "maquinaria", registro_id: row.id })),
      ...failures.slice(0, 30).map((row: any) => ({ id: `falla:${row.id}`, modulo: "Maquinaria", referencia: `Falla · ${row.equipo_patente || row.equipo_tipo || row.id}`, destino: "maquinaria", registro_id: row.id })),
      ...assignments.slice(0, 50).map((row: any) => ({ id: `personal:${row.id}`, modulo: "Recursos Humanos", referencia: `${row.trabajador_nombre} · ${row.cargo || "Sin cargo"}`, destino: "personal", registro_id: row.id }))
    ];
    const preventionSafe = prevention.map((row: any) => { const answers = row.respuestas || {}, follow = answers.__seguimiento_accidente || {}; return { id: row.id, created_at: row.created_at, tipo: answers.tipo || answers.tipo_evento || "Registro preventivo", fecha_evento: answers.fecha_evento || null, descripcion: answers.descripcion || answers.observaciones || null, estado_caso: follow.estado_caso || null, investigacion_requerida: Boolean(follow.investigacion_requerida), clasificacion_evento: follow.clasificacion_evento || null, potencial_gravedad: follow.potencial_gravedad || null, metodologia_investigacion: follow.metodologia_investigacion || null, causa_inmediata: follow.causa_inmediata || null, causa_raiz: follow.causa_raiz || null, riesgo_matriz_referencia: follow.riesgo_matriz_referencia || null, medidas_correctivas: follow.medidas_correctivas || null, acciones: Array.isArray(follow.acciones) ? follow.acciones.map((action: any) => ({ descripcion: action.descripcion, tipo: action.tipo, fecha_compromiso: action.fecha_compromiso, estado: action.estado })) : [], verificacion_eficacia: follow.verificacion_eficacia || null, dias_perdidos: num(follow.dias_perdidos), fuente_id: `prevencion:${row.id}` }; });
    const context: Context = {
      obra: { nombre: worksite.nombre, estado: worksite.estado, tipo: worksite.tipo },
      resumen: { partidas_activas: activities.length, reportes_avance: advances.length, costo_real_total: costs.reduce((sum: number, row: any) => sum + num(row.monto), 0), no_conformidades_abiertas: quality.filter((row: any) => !isClosed(row.estado)).length, registros_prevencion: prevention.length, estados_pago: payments.length },
      partidas: activitySummaries, costos_por_tipo: costByType, calidad: quality.slice(0, 25).map((row: any) => ({ ...row, fuente_id: `calidad:${row.id}` })), prevencion: preventionSafe.slice(0, 25), estados_pago: payments.slice(0, 20).map((row: any) => ({ ...row, fuente_id: `estado_pago:${row.id}` })), restricciones: restrictions.slice(0, 40).map((row: any) => ({ ...row, fuente_id: `restriccion:${row.id}` })), maquinaria: machinery.slice(0, 40).map((row: any) => ({ ...row, horas_reportadas: useByEquipment[String(row.id)] || 0, fuente_id: `maquinaria:${row.id}` })), fallas_maquinaria: failures.slice(0, 30).map((row: any) => ({ ...row, fuente_id: `falla:${row.id}` })), personal_asignado: assignments.slice(0, 50).map((row: any) => ({ ...row, fuente_id: `personal:${row.id}` })), fuentes: sources
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
    const specializedKey = specializedIntent(pregunta);
    if (specializedKey && companyConfig?.funciones?.[specializedKey] !== true) return json({ error: "La asistencia especializada solicitada no está habilitada para esta empresa." }, 403);
    const functionKey = specializedKey || "copiloto";
    const allowedRoles = companyConfig?.limites_funcion?.[functionKey]?.roles_autorizados || companyConfig?.limites_funcion?.copiloto?.roles_autorizados || [];
    if (allowedRoles.length && !allowedRoles.some((role: string) => normalized(role) === normalized(profile.rol))) return json({ error: "Tu rol no está autorizado para usar el Copiloto." }, 403);
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIKey) return json({ error: "La IA del Copiloto no está configurada en el servidor." }, 503);
    const model = companyConfig?.modelo || globalConfig?.ia_modelo || "gpt-4.1-mini";
    const { data: reserved, error: reserveError } = await db.rpc("ia_reservar_consumo", { p_empresa: empresa, p_obra_nombre: obraNombre, p_auth_user_id: authData.user.id, p_usuario: profile.nombre || profile.usuario || profile.correo, p_funcion: functionKey, p_modelo: model, p_reserva_usd: .02 });
    if (reserveError) return json({ error: reserveError.message }, 429);
    reservationId = reserved;
    const aiSourceIds = new Set(["obra:resumen", "costos:resumen", "calidad:resumen", "prevencion:resumen", "estados_pago:resumen", ...activitySummaries.map((item: any) => item.fuente_id), ...quality.map((item: any) => `calidad:${item.id}`), ...prevention.map((item: any) => `prevencion:${item.id}`), ...payments.map((item: any) => `estado_pago:${item.id}`)]);
    const aiContext: any = { obra: context.obra, resumen: context.resumen, partidas: context.partidas, costos_por_tipo: context.costos_por_tipo, calidad: context.calidad, prevencion: context.prevencion, estados_pago: context.estados_pago };
    if (specializedKey === "asistencia_planificacion") { aiContext.restricciones = context.restricciones; context.restricciones.forEach((item: any) => aiSourceIds.add(item.fuente_id)); }
    if (specializedKey === "asistencia_maquinaria") { aiContext.maquinaria = context.maquinaria.map(({ tipo, estado_equipo, horas_reportadas, planes_mantencion, fuente_id }: any) => ({ tipo, estado_equipo, horas_reportadas, planes_mantencion, fuente_id: "maquinaria:resumen" })); aiContext.fallas_maquinaria = context.fallas_maquinaria.map(({ equipo_tipo, fecha, severidad, detuvo_equipo, horas_fuera_servicio, descripcion, causa, solucion }: any) => ({ equipo_tipo, fecha, severidad, detuvo_equipo, horas_fuera_servicio, descripcion, causa, solucion, fuente_id: "maquinaria:resumen" })); aiSourceIds.add("maquinaria:resumen"); }
    if (specializedKey === "asistencia_rrhh") { const today = new Date().toISOString().slice(0, 10); const active = context.personal_asignado.filter((item: any) => (!item.fecha_inicio || item.fecha_inicio <= today) && (!item.fecha_termino || item.fecha_termino >= today)); aiContext.dotacion_por_cargo = Object.entries(active.reduce((acc: Record<string, number>, item: any) => { const role = item.cargo || "Sin cargo"; acc[role] = (acc[role] || 0) + 1; return acc; }, {})).map(([cargo, total]) => ({ cargo, total, fuente_id: "personal:resumen" })); aiSourceIds.add("personal:resumen"); }
    aiContext.fuentes = context.fuentes.filter(source => aiSourceIds.has(source.id));
    const prompt = `Eres el Copiloto de Obraxis para control profesional de construcción. Responde SOLO con el contexto JSON de la obra autorizada. No inventes ni completes datos ausentes. Distingue hechos, cálculos y sugerencias. Para cada hecho usa exclusivamente un fuente_id existente en contexto.fuentes. Si no existe una fuente que respalde una afirmación, omítela o indícala como limitación. Sé breve. La asistencia especializada es solo una propuesta para validación profesional: no modifiques, apruebes, clasifiques ni cierres registros y no afirmes que ejecutaste acciones. Función autorizada: ${functionKey}. Consulta: ${pregunta}`;
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${openAIKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_text", text: JSON.stringify(aiContext) }] }], text: { format: { type: "json_schema", name: "copiloto_contextual_obra", strict: true, schema } } }) });
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
