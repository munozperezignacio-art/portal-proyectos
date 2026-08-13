const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    resumen_ejecutivo: { type: "string" },
    estado_general: {
      type: "string",
      enum: ["Controlado", "Atención", "Crítico", "Sin datos suficientes"],
    },
    hallazgos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          titulo: { type: "string" },
          detalle: { type: "string" },
          severidad: {
            type: "string",
            enum: ["Informativa", "Atención", "Crítica"],
          },
          fuente: { type: "string" },
        },
        required: ["titulo", "detalle", "severidad", "fuente"],
      },
    },
    sugerencias: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          accion: { type: "string" },
          justificacion: { type: "string" },
          prioridad: { type: "string", enum: ["Alta", "Media", "Baja"] },
        },
        required: ["accion", "justificacion", "prioridad"],
      },
    },
    limitaciones: { type: "array", items: { type: "string" } },
  },
  required: [
    "resumen_ejecutivo",
    "estado_general",
    "hallazgos",
    "sugerencias",
    "limitaciones",
  ],
};
const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char,
  );

export async function interpretScheduledReport(
  db: any,
  schedule: any,
  indicators: any,
  works: string[],
  from: Date,
) {
  if (!schedule.usar_ia)
    return { html: "", interpretation: null, consumptionId: null };
  const openAIKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIKey)
    return { html: "", interpretation: null, consumptionId: null };
  const [{ data: globalConfig }, { data: companyConfig }, { data: creators }] =
    await Promise.all([
      db
        .from("config_global_obraxis")
        .select("ia_habilitada,ia_modelo")
        .eq("id", 1)
        .maybeSingle(),
      db
        .from("ia_config_empresas")
        .select("*")
        .eq("empresa", schedule.empresa)
        .maybeSingle(),
      db
        .from("usuarios")
        .select("auth_user_id,nombre,usuario,correo")
        .eq("empresa", schedule.empresa)
        .not("auth_user_id", "is", null),
    ]);
  if (
    globalConfig?.ia_habilitada === false ||
    companyConfig?.habilitada === false ||
    companyConfig?.funciones?.informes === false
  )
    return { html: "", interpretation: null, consumptionId: null };
  const creator = (creators || []).find((item: any) =>
    [item.correo, item.usuario].includes(schedule.creado_por),
  );
  if (!creator?.auth_user_id)
    return { html: "", interpretation: null, consumptionId: null };
  const model =
    companyConfig?.modelo || globalConfig?.ia_modelo || "gpt-4.1-mini";
  const { data: reservationId, error: reserveError } = await db.rpc(
    "ia_reservar_consumo",
    {
      p_empresa: schedule.empresa,
      p_obra_nombre: works.length === 1 ? works[0] : "",
      p_auth_user_id: creator.auth_user_id,
      p_usuario: creator.nombre || creator.usuario || creator.correo,
      p_funcion: "informes",
      p_modelo: model,
      p_reserva_usd: 0.02,
    },
  );
  if (reserveError)
    return { html: "", interpretation: null, consumptionId: null };
  const started = Date.now();
  try {
    const prompt = `Interpreta exclusivamente los indicadores JSON de ${schedule.nombre}, período ${from.toISOString().slice(0, 10)} a ${new Date().toISOString().slice(0, 10)}. No recalcules ni inventes valores. Separa hechos y recomendaciones; cita como fuente el nombre exacto del indicador. Prioriza plazo, costo, Curva S, SPI, CPI, EAC, seguridad y calidad. Redacción ejecutiva y breve.`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_text", text: JSON.stringify(indicators) },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "interpretacion_informe_programado",
            strict: true,
            schema,
          },
        },
      }),
    });
    const apiData = await response.json();
    if (!response.ok)
      throw new Error(
        apiData?.error?.message ||
          "No fue posible interpretar el informe programado.",
      );
    const raw =
      apiData.output_text ||
      apiData.output
        ?.flatMap((x: any) => x.content || [])
        .find((x: any) => x.type === "output_text")?.text;
    if (!raw)
      throw new Error("La IA no devolvió una interpretación utilizable.");
    const result = JSON.parse(raw),
      inputTokens = Number(apiData.usage?.input_tokens || 0),
      outputTokens = Number(apiData.usage?.output_tokens || 0),
      cost = (inputTokens * 0.4 + outputTokens * 1.6) / 1_000_000;
    await db.rpc("ia_finalizar_consumo", {
      p_id: reservationId,
      p_estado: "Completado",
      p_tokens_entrada: inputTokens,
      p_tokens_salida: outputTokens,
      p_costo_usd: cost,
      p_confianza: null,
      p_duracion_ms: Date.now() - started,
      p_error_detalle: "",
      p_metadatos: {
        programacion_id: schedule.id,
        nombre_informe: schedule.nombre,
      },
    });
    const html = `<div style="max-width:780px;margin:14px auto;background:#fff;border:1px solid #c7d2fe;border-radius:18px;padding:20px;font-family:Arial,sans-serif;color:#17233b"><div style="font-size:10px;font-weight:800;color:#4338ca;text-transform:uppercase">Interpretación asistida por IA · envío automático autorizado</div><h2 style="font-size:16px;margin:8px 0">${esc(result.estado_general)}</h2><p style="font-size:12px;line-height:1.6">${esc(result.resumen_ejecutivo)}</p><h3 style="font-size:13px">Hallazgos</h3><ul style="font-size:11px;line-height:1.6">${result.hallazgos.map((x: any) => `<li><b>${esc(x.titulo)}:</b> ${esc(x.detalle)} <span style="color:#64748b">[${esc(x.fuente)}]</span></li>`).join("")}</ul><h3 style="font-size:13px">Acciones sugeridas</h3><ol style="font-size:11px;line-height:1.6">${result.sugerencias.map((x: any) => `<li><b>${esc(x.prioridad)}:</b> ${esc(x.accion)} — ${esc(x.justificacion)}</li>`).join("")}</ol>${result.limitaciones.length ? `<p style="font-size:10px;color:#64748b"><b>Limitaciones:</b> ${result.limitaciones.map(esc).join(" · ")}</p>` : ""}</div>`;
    return { html, interpretation: result, consumptionId: reservationId };
  } catch (error) {
    await db.rpc("ia_finalizar_consumo", {
      p_id: reservationId,
      p_estado: "Error",
      p_tokens_entrada: 0,
      p_tokens_salida: 0,
      p_costo_usd: 0,
      p_confianza: null,
      p_duracion_ms: Date.now() - started,
      p_error_detalle: error instanceof Error ? error.message : String(error),
      p_metadatos: { programacion_id: schedule.id },
    });
    return {
      html: '<div style="max-width:780px;margin:14px auto;padding:12px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;font:11px Arial;color:#92400e">La interpretación asistida no estuvo disponible. El informe fue emitido con sus indicadores determinísticos completos.</div>',
      interpretation: null,
      consumptionId: reservationId,
    };
  }
}
