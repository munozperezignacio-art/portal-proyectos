import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildExecutiveReportHtml } from "./executiveReportHtml.ts";
import { interpretScheduledReport } from "./scheduledReportAI.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const zonedParts = (date: Date, zone: string) => Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
);
const zonedToUtc = (year: number, month: number, day: number, hour: number, minute: number, zone: string) => {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 3; i += 1) {
    const actual = zonedParts(new Date(guess), zone);
    const shown = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
    guess += Date.UTC(year, month - 1, day, hour, minute) - shown;
  }
  return new Date(guess);
};
const nextRun = (s: any, now = new Date()) => {
  const zone = s.zona_horaria || "America/Santiago";
  const local = zonedParts(now, zone);
  const [hour, minute] = String(s.hora_envio || "08:00").split(":").map(Number);
  for (let offset = 0; offset < 370; offset += 1) {
    const candidateDay = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
    const year = candidateDay.getUTCFullYear(), month = candidateDay.getUTCMonth() + 1, day = candidateDay.getUTCDate();
    const matches = s.frecuencia === "Semanal"
      ? candidateDay.getUTCDay() === Number(s.dia_semana || 1) % 7
      : day === Math.min(Number(s.dia_mes || 1), new Date(Date.UTC(year, month, 0)).getUTCDate());
    if (!matches) continue;
    const candidate = zonedToUtc(year, month, day, hour, minute, zone);
    if (candidate > now) return candidate.toISOString();
  }
  throw new Error("No fue posible calcular la próxima ejecución");
};

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "No autorizado" }, 401);
  }
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: schedules, error } = await db
    .from("informes_programaciones")
    .select("*")
    .eq("activa", true)
    .lte("proxima_ejecucion", new Date().toISOString())
    .limit(25);
  if (error) return json({ error: error.message }, 500);
  const results = [];
  for (const s of schedules || []) {
    const claimedNextRun = nextRun(s);
    const { data: claimed } = await db.from("informes_programaciones")
      .update({ proxima_ejecucion: claimedNextRun, updated_at: new Date().toISOString() })
      .eq("id", s.id).eq("proxima_ejecucion", s.proxima_ejecucion).select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const { data: works } = await db
        .from("obras")
        .select("nombre,estado")
        .eq("empresa", s.empresa);
      const names =
        s.alcance_tipo === "Seleccionadas"
          ? s.obras
          : (works || [])
              .filter((x: any) => x.estado !== "Inactiva")
              .map((x: any) => x.nombre);
      const from = new Date();
      const periodDays = s.frecuencia === "Mensual" ? 30 : 7;
      from.setDate(from.getDate() - periodDays);
      const [
        { data: adv },
        { data: attendance },
        { data: cost },
        { data: nc },
        { data: prevention },
        { data: parts },
        { data: equipmentUse },
        { data: failures },
        { data: maintenance },
        { data: personnel },
        { data: users },
        { data: mailConfig },
      ] = await Promise.all([
        db
          .from("avances_produccion_partidas")
          .select("obra_nombre,partida,cantidad,created_at")
          .eq("empresa", s.empresa)
          .in("obra_nombre", names),
        db
          .from("asistencia_personal")
          .select("obra_nombre,asistencia,horas_ordinarias,created_at")
          .in("obra_nombre", names)
          .gte("created_at", from.toISOString()),
        db
          .from("costos_reales_obra")
          .select("obra_nombre,monto,created_at")
          .eq("empresa", s.empresa)
          .in("obra_nombre", names),
        db
          .from("calidad_no_conformidades")
          .select("obra_nombre,estado,fecha_compromiso,clasificacion,causa_categoria,eficacia_verificada,fecha_cierre")
          .eq("empresa", s.empresa)
          .in("obra_nombre", names),
        db
          .from("prevencion_respuestas")
          .select("proyecto_nombre,created_at,respuestas")
          .in("proyecto_nombre", names)
          .gte("created_at", from.toISOString()),
        db
          .from("partidas_obra")
          .select(
            "obra_nombre,partida,cantidad_presupuestada,costo_por_dia,rendimiento_meta,fecha_inicio,fecha_termino",
          )
          .eq("empresa", s.empresa)
          .in("obra_nombre", names),
        db.from("maquinaria_uso_diario").select("obra_nombre,equipo_id,equipo_patente,horas_trabajadas,created_at").eq("empresa", s.empresa).in("obra_nombre", names).gte("created_at", from.toISOString()),
        db.from("maquinaria_fallas").select("equipo_id,fecha,solucion,created_at").eq("empresa", s.empresa),
        db.from("maquinaria_mantenciones").select("equipo_id,fecha,created_at").eq("empresa", s.empresa).gte("created_at", from.toISOString()),
        db.from("maestro_personal").select("id,obra_nombre").eq("empresa", s.empresa),
        db.from("usuarios").select("id,correo,rol").eq("empresa", s.empresa),
        db
          .from("config_empresa")
          .select("email_sender")
          .eq("empresa", "Obraxis")
          .maybeSingle(),
      ]);
      let planning: any[] = [];
      try {
        const { data: relations } = await db.from("obra_presupuestos").select("obra_nombre,presupuesto_id").eq("empresa", s.empresa).in("obra_nombre", names);
        const budgetIds = [...new Set((relations || []).map((row: any) => row.presupuesto_id).filter(Boolean))];
        if (budgetIds.length) {
          const [{ data: scheduleRows }, { data: budgetRows }] = await Promise.all([
            db.from("planificacion_cronogramas").select("presupuesto_id,codigo,tarea,fecha_inicio,fecha_fin,duracion,porcentaje_avance").in("presupuesto_id", budgetIds),
            db.from("presupuestos_items").select("presupuesto_id,codigo,partida").in("presupuesto_id", budgetIds)
          ]);
          planning = (scheduleRows || []).flatMap((task: any) => {
            const relation = (relations || []).find((row: any) => String(row.presupuesto_id) === String(task.presupuesto_id));
            if (!relation) return [];
            const budgetItem = (budgetRows || []).find((row: any) => String(row.presupuesto_id) === String(task.presupuesto_id) && String(row.codigo || "") === String(task.codigo || ""));
            return [{ ...task, obra_nombre: relation.obra_nombre, partida: budgetItem?.partida || task.tarea }];
          });
        }
      } catch (planningError) {
        console.warn("No fue posible incorporar la planificación al informe", planningError);
      }
      const report = buildExecutiveReportHtml({
        schedule: s,
        company: s.empresa,
        selected: names,
        advances: adv || [],
        attendance: attendance || [],
        costs: cost || [],
        nonConformities: nc || [],
        prevention: prevention || [],
        parts: parts || [],
        planning,
        equipmentUse: equipmentUse || [],
        failures: failures || [],
        maintenance: maintenance || [],
        personnel: personnel || [],
        periodDays,
      });
      const ai = await interpretScheduledReport(db, s, report.indicators, names, from);
      const finalHtml = `${report.html}${ai.html}`;
      const roleSet = new Set(s.destinatarios_roles || []),
        idSet = new Set((s.destinatarios_usuarios || []).map(String));
      const recipients = [
        ...new Set(
          [
            ...(users || [])
              .filter((u: any) => roleSet.has(u.rol) || idSet.has(String(u.id)))
              .map((u: any) => u.correo),
            ...(s.correos_adicionales || []),
          ].filter(Boolean),
        ),
      ];
      const shouldEmail = s.incluir_correo !== false;
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (shouldEmail && !resendApiKey)
        throw new Error("Resend no está configurado");
      if (shouldEmail && !recipients.length) throw new Error("Sin destinatarios");
      const response = shouldEmail ? await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Obraxis <${mailConfig.email_sender || "notificaciones@obraxis.cl"}>`,
          to: recipients,
          subject: `${s.nombre} · ${s.empresa}`,
          html: finalHtml,
        }),
      }) : null;
      if (response && !response.ok) throw new Error(await response.text());
      await db
        .from("informes_ejecuciones")
        .insert({
          programacion_id: s.id,
          empresa: s.empresa,
          plantilla_codigo: s.plantilla_codigo,
          nombre: s.nombre,
          periodo_desde: from.toISOString().slice(0, 10),
          periodo_hasta: new Date().toISOString().slice(0, 10),
          obras: names,
          destinatarios: recipients,
          indicadores: report.indicators,
          contenido_html: finalHtml,
          interpretacion_ia: ai.interpretation,
          ia_consumo_id: ai.consumptionId,
          estado: shouldEmail ? "Enviado" : "Generado",
          ejecutado_por: "Programador Obraxis",
          aprobado_por: `Programación autorizada por ${s.creado_por || "usuario"}`,
          aprobado_at: new Date().toISOString(),
          enviada_at: shouldEmail ? new Date().toISOString() : null,
        });
      await db
        .from("informes_programaciones")
        .update({
          ultima_ejecucion: new Date().toISOString(),
          proxima_ejecucion: claimedNextRun,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id);
      results.push({ id: s.id, ok: true });
    } catch (e) {
      await db.from("informes_programaciones").update({
        proxima_ejecucion: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", s.id).eq("proxima_ejecucion", claimedNextRun);
      await db
        .from("informes_ejecuciones")
        .insert({
          programacion_id: s.id,
          empresa: s.empresa,
          plantilla_codigo: s.plantilla_codigo,
          nombre: s.nombre,
          obras: s.obras || [],
          estado: "Error",
          error_detalle: String(e),
          ejecutado_por: "Programador Obraxis",
        });
      results.push({ id: s.id, ok: false, error: String(e) });
    }
  }
  return json({ processed: results.length, results });
});
