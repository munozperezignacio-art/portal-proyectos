import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarClock,
  Edit3,
  Eye,
  Mail,
  Plus,
  Printer,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { sendSystemEmail } from "../utils/emailService";
import { buildExecutiveReportHtml } from "../utils/executiveReportHtml";

const TEMPLATES = [
  [
    "maquinaria_general",
    "Informe general de maquinaria",
    "Maquinaria",
    "Utilización, fallas, mantenciones y disponibilidad de equipos por obra.",
  ],
  [
    "rrhh_general",
    "Informe general de recursos humanos",
    "Recursos humanos",
    "Dotación asignada y personal disponible o sin asignación.",
  ],
  [
    "semanal_obra",
    "Informe semanal de obra",
    "Obras",
    "Producción, plazo, dotación, riesgos y prioridades de los últimos 7 días.",
  ],
  [
    "mensual_obra",
    "Informe mensual de obra",
    "Obras",
    "Cierre ejecutivo mensual de avance, costos, calidad y prevención.",
  ],
  [
    "cartera_obras",
    "Informe general de obras",
    "Corporativo",
    "Comparación gerencial de todas las obras activas y sus excepciones.",
  ],
  [
    "prevencion_general",
    "Informe general de prevención",
    "Prevención",
    "Actividad preventiva, incidentes, registros y exposición por obra.",
  ],
  [
    "costos_corporativo",
    "Informe corporativo de costos",
    "Costos",
    "Costo real, concentración del gasto y obras que requieren intervención.",
  ],
  [
    "calidad_general",
    "Informe general de calidad",
    "Calidad",
    "No conformidades, recepciones y pendientes críticos por obra.",
  ],
];
const empty = {
  plantilla_codigo: "semanal_obra",
  nombre: "Informe semanal de obra",
  alcance_tipo: "Seleccionadas",
  obras: [],
  frecuencia: "Semanal",
  dia_semana: 1,
  dia_mes: 1,
  hora_envio: "08:00",
  destinatarios_roles: [],
  destinatarios_usuarios: [],
  correos_adicionales: [""],
  incluir_pdf: true,
  incluir_correo: true,
  zona_horaria: "America/Santiago",
  usar_ia: true,
  activa: true,
};
const input = "w-full rounded-xl border border-slate-200 p-3 text-xs";
const nextRun = (form) => {
  const now = new Date();
  const target = new Date(now);
  const [h, m] = String(form.hora_envio || "08:00")
    .split(":")
    .map(Number);
  target.setHours(h, m, 0, 0);
  if (form.frecuencia === "Semanal") {
    const wanted = Number(form.dia_semana || 1) % 7;
    let add = (wanted - target.getDay() + 7) % 7;
    if (add === 0 && target <= now) add = 7;
    target.setDate(target.getDate() + add);
  } else {
    target.setDate(Number(form.dia_mes || 1));
    if (target <= now) target.setMonth(target.getMonth() + 1);
  }
  return target.toISOString();
};

export default function ExecutiveReportScheduler({
  user,
  obras = [],
  roles = [],
}) {
  const [schedules, setSchedules] = useState([]),
    [runs, setRuns] = useState([]),
    [users, setUsers] = useState([]),
    [modal, setModal] = useState(false),
    [editingId, setEditingId] = useState(null),
    [form, setForm] = useState(empty),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState(""),
    [previewData, setPreviewData] = useState(null),
    [busy, setBusy] = useState(false);
  const roleNames = useMemo(
    () => [
      ...new Set([
        ...roles
          .filter(
            (r) => !r.archivado && (!r.empresa || r.empresa === user.empresa),
          )
          .map((r) => r.nombre),
        ...users.map((u) => u.rol).filter(Boolean),
      ]),
    ],
    [roles, users, user.empresa],
  );
  const load = async () => {
    const [a, b, c] = await Promise.all([
      supabase
        .from("informes_programaciones")
        .select("*")
        .eq("empresa", user.empresa)
        .order("created_at", { ascending: false }),
      supabase
        .from("informes_ejecuciones")
        .select("*")
        .eq("empresa", user.empresa)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("usuarios")
        .select("id,nombre,correo,rol")
        .eq("empresa", user.empresa),
    ]);
    if (a.error) return setMessage(a.error.message);
    setSchedules(a.data || []);
    setRuns(b.data || []);
    setUsers(c.data || []);
  };
  useEffect(() => {
    load();
  }, [user.empresa]);
  const chooseTemplate = (code) => {
    const t = TEMPLATES.find((x) => x[0] === code);
    setForm((x) => ({
      ...x,
      plantilla_codigo: code,
      nombre: t[1],
      alcance_tipo: [
        "cartera_obras",
        "prevencion_general",
        "costos_corporativo",
        "calidad_general",
        "maquinaria_general",
        "rrhh_general",
      ].includes(code)
        ? "Todas"
        : x.alcance_tipo,
    }));
  };
  const save = async (e) => {
    e.preventDefault();
    if (form.alcance_tipo === "Seleccionadas" && !form.obras.length)
      return setMessage("Selecciona al menos una obra.");
    const payload = {
      ...form,
      empresa: user.empresa,
      correos_adicionales: form.correos_adicionales
        .map((x) => x.trim())
        .filter(Boolean),
      proxima_ejecucion: nextRun(form),
      creado_por: user.correo || user.usuario,
      updated_at: new Date().toISOString(),
    };
    delete payload.id;
    delete payload.created_at;
    const query = editingId
      ? supabase
          .from("informes_programaciones")
          .update(payload)
          .eq("id", editingId)
      : supabase.from("informes_programaciones").insert(payload);
    const { error } = await query;
    if (error) return setMessage(error.message);
    setModal(false);
    setEditingId(null);
    setForm(empty);
    setMessage(
      editingId
        ? "Informe actualizado correctamente."
        : "Informe programado correctamente.",
    );
    load();
  };
  const collect = async (schedule) => {
    const selected =
      schedule.alcance_tipo === "Seleccionadas"
        ? schedule.obras
        : obras.filter((o) => o.estado !== "Inactiva").map((o) => o.nombre);
    const since = new Date();
    since.setDate(
      since.getDate() - (schedule.frecuencia === "Mensual" ? 30 : 7),
    );
    const [adv, attendance, cost, nc, prevention, parts, equipmentUse, failures, maintenance, personnel] = await Promise.all([
      supabase
        .from("avances_produccion_partidas")
        .select("obra_nombre,partida,cantidad,created_at")
        .eq("empresa", user.empresa)
        .in("obra_nombre", selected),
      supabase
        .from("asistencia_personal")
        .select("obra_nombre,asistencia,horas_ordinarias,created_at")
        .in("obra_nombre", selected)
        .gte("created_at", since.toISOString()),
      supabase
        .from("costos_reales_obra")
        .select("obra_nombre,monto,created_at")
        .eq("empresa", user.empresa)
        .in("obra_nombre", selected),
      supabase
        .from("calidad_no_conformidades")
        .select("obra_nombre,estado,fecha_compromiso,clasificacion,causa_categoria,eficacia_verificada,fecha_cierre")
        .eq("empresa", user.empresa)
        .in("obra_nombre", selected),
      supabase
        .from("prevencion_respuestas")
        .select("proyecto_nombre,created_at,respuestas")
        .in("proyecto_nombre", selected)
        .gte("created_at", since.toISOString()),
      supabase
        .from("partidas_obra")
        .select(
          "obra_nombre,partida,cantidad_presupuestada,costo_por_dia,rendimiento_meta,fecha_inicio,fecha_termino",
        )
        .eq("empresa", user.empresa)
        .in("obra_nombre", selected),
      supabase.from("maquinaria_uso_diario").select("obra_nombre,equipo_id,equipo_patente,horas_trabajadas,created_at").eq("empresa", user.empresa).in("obra_nombre", selected).gte("created_at", since.toISOString()),
      supabase.from("maquinaria_fallas").select("equipo_id,fecha,solucion,created_at").eq("empresa", user.empresa),
      supabase.from("maquinaria_mantenciones").select("equipo_id,fecha,created_at").eq("empresa", user.empresa).gte("created_at", since.toISOString()),
      supabase.from("maestro_personal").select("id,obra_nombre").eq("empresa", user.empresa),
    ]);
    let planning = [];
    try {
      const { data: relations } = await supabase.from("obra_presupuestos").select("obra_nombre,presupuesto_id").eq("empresa", user.empresa).in("obra_nombre", selected);
      const budgetIds = [...new Set((relations || []).map(row => row.presupuesto_id).filter(Boolean))];
      if (budgetIds.length) {
        const [{ data: scheduleRows }, { data: budgetRows }] = await Promise.all([
          supabase.from("planificacion_cronogramas").select("presupuesto_id,codigo,tarea,fecha_inicio,fecha_fin,duracion,porcentaje_avance").in("presupuesto_id", budgetIds),
          supabase.from("presupuestos_items").select("presupuesto_id,codigo,partida").in("presupuesto_id", budgetIds)
        ]);
        planning = (scheduleRows || []).flatMap(task => {
          const relation = (relations || []).find(row => String(row.presupuesto_id) === String(task.presupuesto_id));
          if (!relation) return [];
          const budgetItem = (budgetRows || []).find(row => String(row.presupuesto_id) === String(task.presupuesto_id) && String(row.codigo || '') === String(task.codigo || ''));
          return [{ ...task, obra_nombre: relation.obra_nombre, partida: budgetItem?.partida || task.tarea }];
        });
      }
    } catch (planningError) {
      console.warn("No fue posible incorporar la planificación en el informe:", planningError);
    }
    return {
      selected,
      since,
      adv: adv.data || [],
      attendance: attendance.data || [],
      cost: cost.data || [],
      nc: nc.data || [],
      prevention: prevention.data || [],
      parts: parts.data || [],
      planning,
      equipmentUse: equipmentUse.data || [],
      failures: failures.data || [],
      maintenance: maintenance.data || [],
      personnel: personnel.data || [],
    };
  };
  const buildEvm = async (schedule) => {
    const d = await collect(schedule);
    const report = buildExecutiveReportHtml({
      schedule,
      company: user.empresa,
      selected: d.selected,
      advances: d.adv,
      attendance: d.attendance,
      costs: d.cost,
      nonConformities: d.nc,
      prevention: d.prevention,
      parts: d.parts,
      planning: d.planning,
      equipmentUse: d.equipmentUse,
      failures: d.failures,
      maintenance: d.maintenance,
      personnel: d.personnel,
      periodDays: schedule.frecuencia === "Mensual" ? 30 : 7,
    });
    return {
      html: report.html,
      indicators: report.indicators,
      selected: d.selected,
      since: d.since,
    };
  };
  const interpret = async (schedule, result) => {
    if (!schedule.usar_ia)
      return { ...result, interpretation: null, iaConsumptionId: null };
    const { data, error } = await supabase.functions.invoke(
      "interpretar-informe-ia",
      {
        body: {
          empresa: user.empresa,
          obra_nombre: result.selected.length === 1 ? result.selected[0] : "",
          nombre_informe: schedule.nombre,
          periodo: `${result.since.toISOString().slice(0, 10)} a ${new Date().toISOString().slice(0, 10)}`,
          indicadores: result.indicators,
        },
      },
    );
    if (error || data?.error) throw new Error(data?.error || error.message);
    const ia = data.data;
    const esc = (value) =>
      String(value ?? "").replace(
        /[&<>"']/g,
        (char) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[char],
      );
    const block = `<div style="max-width:780px;margin:14px auto;background:#fff;border:1px solid #c7d2fe;border-radius:18px;padding:20px;font-family:Arial,sans-serif;color:#17233b"><div style="font-size:10px;font-weight:800;color:#4338ca;text-transform:uppercase">Interpretación asistida por IA · requiere revisión humana</div><h2 style="font-size:16px;margin:8px 0">${esc(ia.estado_general)}</h2><p style="font-size:12px;line-height:1.6">${esc(ia.resumen_ejecutivo)}</p><h3 style="font-size:13px">Hallazgos</h3><ul style="font-size:11px;line-height:1.6">${ia.hallazgos.map((x) => `<li><b>${esc(x.titulo)}:</b> ${esc(x.detalle)} <span style="color:#64748b">[${esc(x.fuente)}]</span></li>`).join("")}</ul><h3 style="font-size:13px">Acciones sugeridas</h3><ol style="font-size:11px;line-height:1.6">${ia.sugerencias.map((x) => `<li><b>${esc(x.prioridad)}:</b> ${esc(x.accion)} — ${esc(x.justificacion)}</li>`).join("")}</ol>${ia.limitaciones.length ? `<p style="font-size:10px;color:#64748b"><b>Limitaciones:</b> ${ia.limitaciones.map(esc).join(" · ")}</p>` : ""}</div>`;
    return {
      ...result,
      html: `${result.html}${block}`,
      interpretation: ia,
      iaConsumptionId: data.ia_consumo_id,
    };
  };
  const recipients = (schedule) => {
    const roleSet = new Set(schedule.destinatarios_roles || []),
      idSet = new Set((schedule.destinatarios_usuarios || []).map(String));
    return [
      ...new Set(
        [
          ...users
            .filter((u) => roleSet.has(u.rol) || idSet.has(String(u.id)))
            .map((u) => u.correo),
          ...(schedule.correos_adicionales || []),
        ].filter(Boolean),
      ),
    ];
  };
  const run = async (
    schedule,
    send = false,
    preparedResult = null,
    recordExecution = true,
    useAI = true,
  ) => {
    setBusy(true);
    try {
      const baseResult = preparedResult || (await buildEvm(schedule));
      const result = preparedResult || !useAI
        ? baseResult
        : await interpret(schedule, baseResult);
      setPreview(result.html);
      if (!recordExecution) {
        setPreviewData(null);
        return;
      }
      const to = recipients(schedule);
      let state = "Pendiente de aprobación",
        error = null;
      if (send) {
        if (!to.length)
          throw new Error("El informe no tiene destinatarios con correo.");
        const mail = await sendSystemEmail({
          to,
          subject: `${schedule.nombre} · ${user.empresa}`,
          htmlContent: result.html,
          permissionKey: 'admin.permisos.enviar',
        });
        if (!mail.success) throw new Error(mail.error);
        state = "Enviado";
      }
      const executionPayload = {
          programacion_id: schedule.id,
          empresa: user.empresa,
          plantilla_codigo: schedule.plantilla_codigo,
          nombre: schedule.nombre,
          periodo_desde: result.since.toISOString().slice(0, 10),
          periodo_hasta: new Date().toISOString().slice(0, 10),
          obras: result.selected,
          destinatarios: to,
          indicadores: result.indicators,
          contenido_html: result.html,
          interpretacion_ia: result.interpretation,
          ia_consumo_id: result.iaConsumptionId,
          estado: state,
          error_detalle: error,
          ejecutado_por: user.correo || user.usuario,
          aprobado_por: send ? (user.nombre || user.correo || user.usuario) : null,
          aprobado_at: send ? new Date().toISOString() : null,
          enviada_at: send ? new Date().toISOString() : null,
      };
      let executionId = previewData?.executionId || null;
      if (send && executionId) {
        const { error: updateError } = await supabase.from("informes_ejecuciones").update(executionPayload).eq("id", executionId);
        if (updateError) throw updateError;
      } else {
        const { data: execution, error: insertError } = await supabase.from("informes_ejecuciones").insert(executionPayload).select("id").single();
        if (insertError) throw insertError;
        executionId = execution.id;
      }
      setPreviewData({ schedule, result, executionId });
      if (send) {
        await supabase
          .from("informes_programaciones")
          .update({
            ultima_ejecucion: new Date().toISOString(),
            proxima_ejecucion: nextRun(schedule),
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);
        setMessage("Informe generado y enviado correctamente.");
        setPreview("");
        setPreviewData(null);
      }
      load();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    if (!confirm("¿Eliminar esta programación? El historial se conservará."))
      return;
    await supabase.from("informes_programaciones").delete().eq("id", id);
    load();
  };
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...empty, correos_adicionales: [""] });
    setModal(true);
  };
  const openEdit = (schedule) => {
    setEditingId(schedule.id);
    setForm({
      ...empty,
      ...schedule,
      obras: schedule.obras || [],
      destinatarios_roles: schedule.destinatarios_roles || [],
      destinatarios_usuarios: schedule.destinatarios_usuarios || [],
      correos_adicionales: schedule.correos_adicionales?.length
        ? schedule.correos_adicionales
        : [""],
    });
    setModal(true);
  };
  const toggle = async (schedule) => {
    const { error } = await supabase
      .from("informes_programaciones")
      .update({
        activa: !schedule.activa,
        updated_at: new Date().toISOString(),
        ...(!schedule.activa ? { proxima_ejecucion: nextRun(schedule) } : {}),
      })
      .eq("id", schedule.id);
    setMessage(
      error
        ? error.message
        : `Informe ${schedule.activa ? "pausado" : "activado"} correctamente.`,
    );
    load();
  };
  const printReport = (execution) => {
    const reportWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!reportWindow) {
      setMessage("El navegador bloqueó la ventana de impresión.");
      return;
    }
    reportWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${execution.nombre || "Informe Obraxis"}</title><style>@page{size:A4;margin:12mm}body{margin:0;background:#fff} @media print{button{display:none!important}}</style></head><body>${execution.contenido_html || ""}<script>window.onload=()=>window.print()</script></body></html>`);
    reportWindow.document.close();
  };
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-blue-950 to-indigo-800 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-3">
            <BarChart3 className="h-7 w-7 text-orange-400" />
            <div>
              <h3 className="text-lg font-black">Informes programados</h3>
              <p className="text-xs text-blue-100">
                Informes ejecutivos, gráficos y configurables construidos desde
                los datos reales de Obraxis.
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-black"
          >
            <Plus className="h-4 w-4" />
            Programar informe
          </button>
        </div>
      </div>
      {message && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          {message}
        </p>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {schedules.map((s) => (
          <div key={s.id} className="rounded-2xl border bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-indigo-700">
                  {TEMPLATES.find((x) => x[0] === s.plantilla_codigo)?.[2]} ·{" "}
                  {s.frecuencia}
                </span>
                <h4 className="font-black">{s.nombre}</h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  Próximo envío:{" "}
                  {s.proxima_ejecucion
                    ? new Date(s.proxima_ejecucion).toLocaleString("es-CL")
                    : "Por calcular"}{" "}
                  · {(s.obras || []).length || "Todas"} obras
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggle(s)}
                  className={`rounded-full px-2.5 py-1 text-[9px] font-black ${s.activa ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                >
                  {s.activa ? "Activo" : "Pausado"}
                </button>
                <button
                  onClick={() => openEdit(s)}
                  className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"
                  title="Editar informe"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                  title="Eliminar informe"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                disabled={busy}
                onClick={() => run(s, false, null, false, false)}
                className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-[10px] font-black"
              >
                <Eye className="h-3 w-3" />
                Vista previa
              </button>
              <button
                disabled={busy}
                onClick={() => run(s, false)}
                className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-[10px] font-black text-white"
              >
                <Send className="h-3 w-3" />
                Generar para revisión
              </button>
            </div>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-black text-slate-900">
              <CalendarClock className="h-4 w-4 text-indigo-700" />
              Historial de informes
            </h4>
            <p className="text-[10px] text-slate-500">
              Versiones generadas, aprobadas y enviadas por la empresa.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[9px] font-black text-slate-600">
            {runs.length} registros recientes
          </span>
        </div>
        {runs.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[10px]">
              <thead className="bg-slate-50 uppercase text-slate-500">
                <tr>
                  <th className="p-3">Informe</th>
                  <th className="p-3">Período / obras</th>
                  <th className="p-3">Destinatarios</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3 text-right">Documento</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map((execution) => (
                  <tr key={execution.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <b className="block text-xs text-slate-900">{execution.nombre}</b>
                      <span className="text-slate-500">
                        {execution.interpretacion_ia ? "Con interpretación IA" : "Cálculo Obraxis"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">
                      <b>{execution.periodo_desde || "—"}</b> a <b>{execution.periodo_hasta || "—"}</b>
                      <span className="block">{(execution.obras || []).length} obra(s)</span>
                    </td>
                    <td className="p-3 text-slate-600">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{(execution.destinatarios || []).length}</span>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2.5 py-1 font-black ${execution.estado === "Enviado" ? "bg-emerald-100 text-emerald-700" : execution.estado === "Error" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>
                        {execution.estado}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">
                      <b className="block">{execution.aprobado_por || execution.ejecutado_por || "Sistema Obraxis"}</b>
                      <span>{new Date(execution.enviada_at || execution.created_at).toLocaleString("es-CL")}</span>
                    </td>
                    <td className="p-3 text-right">
                      {execution.contenido_html ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setPreview(execution.contenido_html);
                              setPreviewData(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-2 font-black text-indigo-700"
                          >
                            <Eye className="h-3 w-3" /> Ver
                          </button>
                          <button
                            onClick={() => printReport(execution)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 font-black text-slate-700"
                            title="Imprimir o guardar como PDF"
                          >
                            <Printer className="h-3 w-3" /> PDF
                          </button>
                        </div>
                      ) : <span className="text-slate-400">Sin documento</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">
            Aún no existen informes generados para esta empresa.
          </p>
        )}
      </section>
      {preview && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 p-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex justify-end gap-2">
              {previewData && (
                <button
                  disabled={busy}
                  onClick={() => run(previewData.schedule, true, previewData.result)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Aprobar y enviar
                </button>
              )}
              <button
                onClick={() => { setPreview(""); setPreviewData(null); }}
                className="rounded-xl bg-white p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </div>
        </div>
      )}
      {modal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-3">
          <form
            onSubmit={save}
            className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6"
          >
            <div className="flex justify-between">
              <div>
                <h3 className="text-lg font-black">Gestionar informe</h3>
                <p className="text-xs text-slate-500">
                  Gestiona contenido, periodicidad, alcance, estado y
                  destinatarios.
                </p>
              </div>
              <button type="button" onClick={() => setModal(false)}>
                <X />
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <b className="text-[10px] uppercase text-slate-500">
                  Plantilla
                </b>
                <select
                  className={input}
                  value={form.plantilla_codigo}
                  onChange={(e) => chooseTemplate(e.target.value)}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t[0]} value={t[0]}>
                      {t[2]} · {t[1]}
                    </option>
                  ))}
                </select>
                <small className="text-slate-500">
                  {TEMPLATES.find((x) => x[0] === form.plantilla_codigo)?.[3]}
                </small>
              </label>
              <label>
                <b className="text-[10px] uppercase text-slate-500">Nombre</b>
                <input
                  required
                  className={input}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </label>
              <label>
                <b className="text-[10px] uppercase text-slate-500">Alcance</b>
                <select
                  className={input}
                  value={form.alcance_tipo}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      alcance_tipo: e.target.value,
                      obras: e.target.value === "Todas" ? [] : form.obras,
                    })
                  }
                >
                  <option>Todas</option>
                  <option>Seleccionadas</option>
                </select>
              </label>
              {form.alcance_tipo === "Seleccionadas" && (
                <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
                  {obras.map((o) => (
                    <label
                      key={o.nombre}
                      className="flex items-center gap-2 rounded-xl border p-3 text-xs font-bold"
                    >
                      <input
                        type="checkbox"
                        checked={form.obras.includes(o.nombre)}
                        onChange={() =>
                          setForm({
                            ...form,
                            obras: form.obras.includes(o.nombre)
                              ? form.obras.filter((x) => x !== o.nombre)
                              : [...form.obras, o.nombre],
                          })
                        }
                      />
                      {o.nombre}
                    </label>
                  ))}
                </div>
              )}
              <label>
                <b className="text-[10px] uppercase text-slate-500">
                  Frecuencia
                </b>
                <select
                  className={input}
                  value={form.frecuencia}
                  onChange={(e) =>
                    setForm({ ...form, frecuencia: e.target.value })
                  }
                >
                  <option>Semanal</option>
                  <option>Mensual</option>
                </select>
              </label>
              <label>
                <b className="text-[10px] uppercase text-slate-500">Hora</b>
                <input
                  type="time"
                  className={input}
                  value={form.hora_envio}
                  onChange={(e) =>
                    setForm({ ...form, hora_envio: e.target.value })
                  }
                />
              </label>
              {form.frecuencia === "Semanal" ? (
                <label>
                  <b className="text-[10px] uppercase text-slate-500">
                    Día de envío
                  </b>
                  <select
                    className={input}
                    value={form.dia_semana}
                    onChange={(e) =>
                      setForm({ ...form, dia_semana: Number(e.target.value) })
                    }
                  >
                    {[
                      "Domingo",
                      "Lunes",
                      "Martes",
                      "Miércoles",
                      "Jueves",
                      "Viernes",
                      "Sábado",
                    ].map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  <b className="text-[10px] uppercase text-slate-500">
                    Día del mes
                  </b>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    className={input}
                    value={form.dia_mes}
                    onChange={(e) =>
                      setForm({ ...form, dia_mes: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  type="checkbox"
                  checked={form.incluir_correo !== false}
                  onChange={(e) => setForm({ ...form, incluir_correo: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-indigo-700"
                />
                <span>
                  <b className="block text-xs text-slate-900">Enviar por correo</b>
                  <small className="text-[10px] leading-5 text-slate-500">Si se desactiva, el informe se genera y queda disponible en el historial, sin distribuirse.</small>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <input
                  type="checkbox"
                  checked={form.incluir_pdf !== false}
                  onChange={(e) => setForm({ ...form, incluir_pdf: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-indigo-700"
                />
                <span>
                  <b className="block text-xs text-slate-900">Habilitar versión PDF</b>
                  <small className="text-[10px] leading-5 text-slate-500">Permite imprimir o guardar como PDF la versión aprobada desde el historial.</small>
                </span>
              </label>
              <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <input
                  type="checkbox"
                  checked={form.usar_ia !== false}
                  onChange={(e) => setForm({ ...form, usar_ia: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-indigo-700"
                />
                <span>
                  <b className="block text-xs text-indigo-950">Interpretación asistida por IA</b>
                  <small className="text-[10px] leading-5 text-indigo-700">
                    OpenAI redactará hallazgos y sugerencias usando solo los indicadores calculados por Obraxis. Requiere revisión humana y consume el presupuesto de IA de la empresa.
                  </small>
                </span>
              </label>
              <div className="md:col-span-2">
                <b className="text-[10px] uppercase text-slate-500">
                  Destinatarios por rol
                </b>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roleNames.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() =>
                        setForm({
                          ...form,
                          destinatarios_roles:
                            form.destinatarios_roles.includes(r)
                              ? form.destinatarios_roles.filter((x) => x !== r)
                              : [...form.destinatarios_roles, r],
                        })
                      }
                      className={`rounded-full px-3 py-2 text-[10px] font-black ${form.destinatarios_roles.includes(r) ? "bg-indigo-800 text-white" : "bg-slate-100"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="flex justify-between">
                  <b className="text-[10px] uppercase text-slate-500">
                    Correos adicionales
                  </b>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        correos_adicionales: [...form.correos_adicionales, ""],
                      })
                    }
                    className="text-[10px] font-black text-indigo-700"
                  >
                    + Correo
                  </button>
                </div>
                {form.correos_adicionales.map((v, i) => (
                  <input
                    key={i}
                    type="email"
                    className={`${input} mt-2`}
                    value={v}
                    placeholder={`Correo ${i + 1}`}
                    onChange={(e) => {
                      const a = [...form.correos_adicionales];
                      a[i] = e.target.value;
                      setForm({ ...form, correos_adicionales: a });
                    }}
                  />
                ))}
              </div>
            </div>
            <button className="mt-6 w-full rounded-xl bg-slate-950 py-3 text-xs font-black text-white">
              {editingId ? "Guardar cambios" : "Guardar programación"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
