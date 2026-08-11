import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Mail,
  MessageSquarePlus,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { sendSystemEmail } from "../utils/emailService";
import { auditActor, appendAudit } from "../utils/documentAudit";
import { registrarEventoBitacora } from "../utils/bitacoraService";
import useUserPermissions from "../utils/useUserPermissions";
import { can } from "../utils/permissionsCatalog";

const emptyEntry = () => ({
  tipo: "Registro diario",
  fecha: new Date().toISOString().slice(0, 10),
  asunto: "",
  detalle: "",
  emisor: "",
  destinatario: "",
  partida: "",
});
const types = [
  "Registro diario",
  "Instrucción",
  "Observación",
  "Acuerdo",
  "Incidente",
];
const statusStyle = {
  Emitido: "bg-slate-100 text-slate-700",
  Autorizado: "bg-blue-100 text-blue-800",
  "Enviado al cliente": "bg-indigo-100 text-indigo-800",
  "Observado por cliente": "bg-amber-100 text-amber-800",
  "Aceptado por cliente": "bg-emerald-100 text-emerald-800",
  "Aceptado con observaciones": "bg-emerald-100 text-emerald-800",
  Cerrado: "bg-slate-200 text-slate-700",
};
const accessCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
};
const token = () =>
  `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
const hashAccessCode = async (value) => {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      String(value || "")
        .trim()
        .toUpperCase(),
    ),
  );
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const printableDate = (value) =>
  value ? new Date(value).toLocaleString("es-CL") : "No informado";

export default function LibroObrasDigital({ user, obraNombre, obra }) {
  const [entries, setEntries] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [form, setForm] = useState(emptyEntry);
  const [filter, setFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [visibleCodes, setVisibleCodes] = useState({});
  const { permissions, loading: permissionsLoading } = useUserPermissions(user);
  const empresa = user?.empresa || null;
  const canView = can(user, permissions, "obras.libro_obra.ver");
  const canCreate = can(user, permissions, "obras.libro_obra.crear");
  const canEdit = can(user, permissions, "obras.libro_obra.editar");
  const canSend = can(user, permissions, "obras.libro_obra.enviar");
  const canReview = can(user, permissions, "obras.libro_obra.revisar");
  const canApprove = can(user, permissions, "obras.libro_obra.aprobar");
  const canDownload = can(user, permissions, "obras.libro_obra.descargar");
  const clientName = obra?.cliente || "";
  const clientEmail = obra?.cliente_email || "";
  const load = async () => {
    if (!obraNombre) return;
    setLoading(true);
    setMessage("");
    try {
      const [entriesResult, partidasResult] = await Promise.all([
        supabase
          .from("libro_obra_digital")
          .select("*")
          .eq("empresa", empresa)
          .eq("obra_nombre", obraNombre)
          .order("fecha", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("partidas_obra")
          .select("partida, unidad")
          .eq("obra_nombre", obraNombre),
      ]);
      if (entriesResult.error) throw entriesResult.error;
      if (partidasResult.error) throw partidasResult.error;
      setEntries(entriesResult.data || []);
      setPartidas(
        (partidasResult.data || []).filter(
          (p) => !["TITULO", "GRUPO"].includes(p.unidad),
        ),
      );
    } catch (error) {
      setMessage(
        error.message?.includes("libro_obra_digital")
          ? "Falta habilitar Libro de Obras en Supabase. Ejecuta schema_libro_obras.sql y actualiza."
          : `No fue posible cargar el Libro de Obras: ${error.message}`,
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [empresa, obraNombre]);
  const visibleEntries = useMemo(
    () =>
      filter === "Todos"
        ? entries
        : entries.filter((entry) => entry.tipo === filter),
    [entries, filter],
  );
  const updateEntry = async (entry, changes, action, comment = "") => {
    const trail = appendAudit(
      entry.trazabilidad,
      auditActor(
        user,
        action,
        changes.flujo_estado || entry.flujo_estado || "Emitido",
        comment,
      ),
    );
    const { error } = await supabase
      .from("libro_obra_digital")
      .update({ ...changes, trazabilidad: trail })
      .eq("id", entry.id);
    if (error) throw error;
    await registrarEventoBitacora({
      empresa,
      obraNombre,
      categoria: "Libro de Obra",
      accion: `${entry.folio} · ${action}`,
      detalle: comment || entry.asunto,
      actor: user?.nombre || user?.email || "Usuario autorizado",
    });
    await load();
  };
  const saveEntry = async (event) => {
    event.preventDefault();
    if (!(editing ? canEdit : canCreate)) {
      setMessage(
        "Tu perfil no está autorizado para emitir o modificar folios.",
      );
      return;
    }
    try {
      if (editing) {
        await updateEntry(
          editing,
          {
            ...form,
            flujo_estado: "Emitido",
            estado: "Abierto",
            respuesta: null,
            fecha_respuesta: null,
            fecha_cierre: null,
          },
          "Folio corregido y reemitido",
          "Se incorporaron ajustes antes de una nueva autorización.",
        );
        setMessage(
          `${editing.folio} quedó reemitido y requiere nueva autorización.`,
        );
        setEditing(null);
        setForm(emptyEntry());
        return;
      }
      const folio = `LO-${new Date().getFullYear()}-${String(entries.length + 1).padStart(3, "0")}`;
      const trazabilidad = [
        auditActor(
          user,
          "Folio emitido",
          "Emitido",
          "Documento generado desde el sistema Obraxis.",
        ),
      ];
      const { error } = await supabase
        .from("libro_obra_digital")
        .insert({
          empresa,
          obra_nombre: obraNombre,
          folio,
          estado: "Abierto",
          flujo_estado: "Emitido",
          trazabilidad,
          ...form,
        });
      if (error) throw error;
      await registrarEventoBitacora({
        empresa,
        obraNombre,
        categoria: "Libro de Obra",
        accion: `${folio} emitido`,
        detalle: form.asunto,
        actor: form.emisor || user?.nombre || user?.email,
        fecha: form.fecha,
      });
      setForm(emptyEntry());
      setMessage(
        `${folio} emitido. Ahora debe autorizarse antes de enviarlo al cliente.`,
      );
      await load();
    } catch (error) {
      setMessage(`No se pudo guardar el folio: ${error.message}`);
    }
  };
  const authorise = async (entry) => {
    if (!canApprove) { setMessage("Tu perfil no está autorizado para aprobar folios."); return; }
    try {
      await updateEntry(
        entry,
        {
          flujo_estado: "Autorizado",
          autorizador_nombre:
            user?.nombre || user?.email || "Usuario autorizado",
        },
        "Autorizado para envío al cliente",
      );
      setMessage(`${entry.folio} autorizado. Ya puedes enviarlo al cliente.`);
    } catch (error) {
      setMessage(`No se pudo autorizar: ${error.message}`);
    }
  };
  const sendToClient = async (entry) => {
    if (!canSend) { setMessage("Tu perfil no está autorizado para enviar folios."); return; }
    if (!clientEmail) {
      setMessage(
        "Configura el correo del cliente en la ficha de la obra antes de enviar el folio.",
      );
      return;
    }
    try {
      const code = accessCode();
      const link = `${window.location.origin}/?libro_obra=${token()}`;
      const clientToken = link.split("libro_obra=")[1];
      const result = await sendSystemEmail({
        to: clientEmail,
        subject: `Libro de Obra ${entry.folio} · ${obraNombre}`,
        htmlContent: `<p>Hola ${clientName || ""},</p><p>Se ha enviado el folio <b>${entry.folio}</b> del Libro de Obra para su revisión.</p><p><a href="${link}">Abrir folio</a></p><p><b>Clave de acceso: ${code}</b></p><p>Desde el enlace puedes aceptar o dejar observaciones, identificando a la persona que responde.</p>`,
      });
      if (!result.success) throw new Error(result.error);
      await updateEntry(
        entry,
        {
          flujo_estado: "Enviado al cliente",
          token_cliente: clientToken,
          clave_cliente_hash: await hashAccessCode(code),
          destinatario:
            entry.destinatario || `${clientName || "Cliente"} <${clientEmail}>`,
        },
        "Enviado al cliente",
        `Enviado a ${clientEmail}.`,
      );
      setVisibleCodes((current) => ({ ...current, [entry.id]: code }));
      setMessage(`Folio enviado a ${clientEmail}.`);
    } catch (error) {
      setMessage(`No se pudo enviar al cliente: ${error.message}`);
    }
  };
  const closeEntry = async (entry) => {
    if (!canApprove) { setMessage("Tu perfil no está autorizado para cerrar folios."); return; }
    try {
      await updateEntry(
        entry,
        {
          flujo_estado: "Cerrado",
          estado: "Cerrado",
          fecha_cierre: new Date().toISOString().slice(0, 10),
        },
        "Folio cerrado",
      );
      setMessage(`${entry.folio} cerrado.`);
    } catch (error) {
      setMessage(`No se pudo cerrar el folio: ${error.message}`);
    }
  };
  const acceptComments = async (entry) => {
    if (!canReview) { setMessage("Tu perfil no está autorizado para resolver observaciones."); return; }
    try {
      await updateEntry(
        entry,
        {
          flujo_estado: "Aceptado con observaciones",
          estado: "Cerrado",
          fecha_cierre: new Date().toISOString().slice(0, 10),
        },
        "Observaciones aceptadas y folio cerrado",
        entry.respuesta || "Comentarios del cliente aceptados.",
      );
      setMessage(`${entry.folio} cerrado aceptando las observaciones.`);
    } catch (error) {
      setMessage(`No se pudo cerrar el folio: ${error.message}`);
    }
  };
  const startEdit = (entry) => {
    if (!canEdit) { setMessage("Tu perfil no está autorizado para modificar folios."); return; }
    setEditing(entry);
    setForm({
      tipo: entry.tipo,
      fecha: entry.fecha || "",
      asunto: entry.asunto || "",
      detalle: entry.detalle || "",
      emisor: entry.emisor || "",
      destinatario: entry.destinatario || "",
      partida: entry.partida || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const downloadEntrySheet = (entry) => {
    if (!canDownload) {
      setMessage("Tu perfil no está autorizado para descargar folios.");
      return;
    }
    const printWindow = window.open("", "_blank", "width=980,height=780");
    if (!printWindow) {
      setMessage(
        "Permite las ventanas emergentes para descargar la hoja del Libro de Obra.",
      );
      return;
    }
    const auditRows = (entry.trazabilidad || []).length
      ? (entry.trazabilidad || [])
          .map(
            (record) =>
              `<tr><td>${escapeHtml(record.accion)}</td><td>${escapeHtml(record.estado)}</td><td>${escapeHtml(record.nombre)}<br><span>${escapeHtml(record.rut)} · ${escapeHtml(record.cargo)}</span></td><td>${escapeHtml(record.empresa)}</td><td>${escapeHtml(printableDate(record.fecha_hora))}</td><td>${escapeHtml(record.comentario || "—")}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="6">Sin acciones registradas.</td></tr>';
    printWindow.document.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(entry.folio)} · Libro de Obra</title><style>@page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17233c;font-size:11px}.head{display:flex;align-items:center;justify-content:space-between;border:1px solid #cbd5e1;border-radius:10px;padding:12px 16px}.head img{height:42px;width:auto;object-fit:contain}.brand{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:700}.folio{font-family:monospace;font-size:13px;font-weight:800;color:#1e3a8a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}.cell{border:1px solid #dbe3ee;border-radius:7px;padding:9px}.label{font-size:8px;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:700;margin-bottom:4px}.wide{grid-column:1/-1}.title{font-size:18px;font-weight:800;margin:0}.response{margin-top:14px;border:1px solid #f5cf54;background:#fffbeb;border-radius:8px;padding:10px}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:9px}th{background:#edf2f7;text-align:left;text-transform:uppercase;font-size:8px;letter-spacing:.04em}th,td{border:1px solid #dbe3ee;padding:7px;vertical-align:top}td span{color:#64748b;font-size:8px}.footer{margin-top:14px;border-top:1px solid #cbd5e1;padding-top:8px;color:#64748b;font-size:8px}@media print{.no-print{display:none}}</style></head><body><div class="head"><img src="${window.location.origin}/brand/obraxis-primary.png" alt="Obraxis"><div><div class="brand">Libro de Obras Digital</div><div class="folio">${escapeHtml(entry.folio)}</div></div></div><div class="grid"><div class="cell"><div class="label">Obra</div>${escapeHtml(obraNombre)}</div><div class="cell"><div class="label">Fecha / tipo</div>${escapeHtml(entry.fecha)} · ${escapeHtml(entry.tipo)}</div><div class="cell wide"><div class="label">Asunto</div><h1 class="title">${escapeHtml(entry.asunto)}</h1></div><div class="cell wide"><div class="label">Detalle del registro</div>${escapeHtml(entry.detalle).replace(/\n/g, "<br>")}</div><div class="cell"><div class="label">Emitido por</div>${escapeHtml(entry.emisor || "No informado")}</div><div class="cell"><div class="label">Dirigido a</div>${escapeHtml(entry.destinatario || "No informado")}</div><div class="cell"><div class="label">Estado del flujo</div>${escapeHtml(entry.flujo_estado || entry.estado || "Emitido")}</div><div class="cell"><div class="label">Partida relacionada</div>${escapeHtml(entry.partida || "No aplica")}</div></div>${entry.respuesta ? `<div class="response"><b>Respuesta / comentario del cliente</b><br><br>${escapeHtml(entry.respuesta).replace(/\n/g, "<br>")}</div>` : ""}<h2 style="font-size:12px;margin:18px 0 0">Registro de acciones · Sistema Obraxis</h2><table><thead><tr><th>Acción</th><th>Estado</th><th>Persona</th><th>Empresa</th><th>Fecha y hora</th><th>Comentario</th></tr></thead><tbody>${auditRows}</tbody></table><div class="footer">Documento generado mediante Sistema Obraxis · ${escapeHtml(new Date().toLocaleString("es-CL"))}</div><script>window.onload=()=>window.print()<\/script></body></html>`,
    );
    printWindow.document.close();
  };
  const input =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-600 focus:outline-none";
  if (permissionsLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Cargando permisos…</div>;
  if (!canView) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-sm font-bold text-amber-900">Tu perfil no tiene permiso para ver el Libro de Obras.</div>;
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6 text-blue-800" />
            <h2 className="text-xl font-black text-slate-900">
              Libro de Obras Digital
            </h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Flujo formal: emisión, autorización, envío al cliente, respuesta,
            corrección y cierre trazable.
          </p>
        </div>
        <button
          onClick={load}
          className="flex w-fit items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>
      {message && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          {message}
        </div>
      )}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-950">
        <Mail className="mr-1 inline h-3.5 w-3.5" />
        <b>Cliente:</b> {clientName || "Sin mandante"}
        {clientEmail ? ` · ${clientEmail}` : " · Sin correo configurado"}
      </div>
      <div className="grid gap-4 xl:grid-cols-[390px_1fr]">
        {(canCreate || (editing && canEdit)) ? <form
          onSubmit={saveEntry}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-800">
            <MessageSquarePlus className="h-4 w-4 text-blue-800" />
            {editing ? `Corregir ${editing.folio}` : "Emitir nuevo folio"}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className={input}
            >
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <input
              type="date"
              required
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className={input}
            />
          </div>
          <input
            required
            placeholder="Asunto o materia"
            value={form.asunto}
            onChange={(e) => setForm({ ...form, asunto: e.target.value })}
            className={input}
          />
          <textarea
            required
            rows={5}
            placeholder="Detalle del registro, instrucción, acuerdo u observación"
            value={form.detalle}
            onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            className={input}
          />
          <input
            required
            placeholder="Emitido por"
            value={form.emisor}
            onChange={(e) => setForm({ ...form, emisor: e.target.value })}
            className={input}
          />
          <input
            placeholder="Dirigido a (opcional)"
            value={form.destinatario}
            onChange={(e) => setForm({ ...form, destinatario: e.target.value })}
            className={input}
          />
          <select
            value={form.partida}
            onChange={(e) => setForm({ ...form, partida: e.target.value })}
            className={input}
          >
            <option value="">Partida relacionada (opcional)</option>
            {partidas.map((p) => (
              <option key={p.partida} value={p.partida}>
                {p.partida}
              </option>
            ))}
          </select>
          <button
            disabled={editing ? !canEdit : !canCreate}
            className="w-full rounded-xl bg-blue-900 py-2.5 text-xs font-black text-white disabled:opacity-50"
          >
            {editing ? "Guardar corrección y reemitir" : "Emitir folio"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(emptyEntry());
              }}
              className="w-full rounded-xl border border-slate-300 py-2 text-xs font-black text-slate-700"
            >
              Cancelar corrección
            </button>
          )}
        </form> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-xs font-semibold text-slate-600">Tu perfil tiene acceso de consulta al Libro de Obras.</div>}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-black text-slate-800">
                {entries.length} folios registrados
              </p>
              <p className="text-[11px] text-slate-500">
                Cada acción se registra con identidad, fecha/hora y Sistema
                Obraxis.
              </p>
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
            >
              <option>Todos</option>
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Cargando folios…
            </div>
          ) : visibleEntries.length ? (
            visibleEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-blue-900">
                        {entry.folio}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">
                        {entry.tipo}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black ${statusStyle[entry.flujo_estado || "Emitido"]}`}
                      >
                        {entry.flujo_estado || "Emitido"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-black text-slate-800">
                      {entry.asunto}
                    </h3>
                  </div>
                  <p className="text-xs font-bold text-slate-500">
                    {entry.fecha}
                  </p>
                </div>
                <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-slate-700">
                  {entry.detalle}
                </p>
                {entry.respuesta && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    <b>Respuesta / comentario del cliente:</b>
                    <p className="mt-1 whitespace-pre-line">
                      {entry.respuesta}
                    </p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-[11px]">
                  {canDownload && <button
                    type="button"
                    onClick={() => downloadEntrySheet(entry)}
                    className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-black text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar hoja
                  </button>}
                  {canApprove && entry.flujo_estado === "Emitido" && (
                    <button
                      onClick={() => authorise(entry)}
                      className="flex items-center gap-1 rounded-lg bg-blue-800 px-3 py-2 font-black text-white"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Autorizar envío
                    </button>
                  )}
                  {canSend && entry.flujo_estado === "Autorizado" && (
                    <button
                      onClick={() => sendToClient(entry)}
                      className="flex items-center gap-1 rounded-lg bg-indigo-700 px-3 py-2 font-black text-white"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Enviar al cliente
                    </button>
                  )}
                  {(canEdit || canReview) &&
                    entry.flujo_estado === "Observado por cliente" && (
                      <>
                        {canEdit && <button
                          onClick={() => startEdit(entry)}
                          className="rounded-lg bg-amber-700 px-3 py-2 font-black text-white"
                        >
                          Modificar y reenviar
                        </button>}
                        {canReview && <button
                          onClick={() => acceptComments(entry)}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 font-black text-emerald-800"
                        >
                          Aceptar con comentarios
                        </button>}
                      </>
                    )}
                  {canApprove &&
                    entry.flujo_estado === "Aceptado por cliente" && (
                      <button
                        onClick={() => closeEntry(entry)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 font-black text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Cerrar folio
                      </button>
                    )}
                  {visibleCodes[entry.id] && (
                    <span className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-950">
                      <KeyRound className="h-3.5 w-3.5" />
                      <b>Clave:</b>{" "}
                      <code className="font-black tracking-widest">
                        {visibleCodes[entry.id]}
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(visibleCodes[entry.id])
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </div>
                <AuditTrail records={entry.trazabilidad} />
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
              Aún no existen folios en el Libro de Obras de esta obra.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function AuditTrail({ records = [] }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        Registro de acciones · Sistema Obraxis
      </p>
      {records.length ? (
        <div className="mt-2 space-y-2">
          {records.map((record, index) => (
            <div
              key={`${record.fecha_hora}-${index}`}
              className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] text-slate-600"
            >
              <b className="text-slate-800">{record.accion}</b> ·{" "}
              {record.estado}
              <span className="ml-1">
                · {record.nombre} · RUT {record.rut} · {record.cargo} ·{" "}
                {record.empresa}
              </span>
              <span className="ml-1 text-slate-400">
                · {new Date(record.fecha_hora).toLocaleString("es-CL")} ·{" "}
                {record.medio || "Sistema Obraxis"}
              </span>
              {record.comentario && <p className="mt-1">{record.comentario}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-slate-400">
          Sin acciones registradas aún.
        </p>
      )}
    </div>
  );
}
