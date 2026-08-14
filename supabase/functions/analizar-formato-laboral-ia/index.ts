import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const allowedVariables = ["nombre_trabajador", "rut", "cargo", "sueldo_base", "obra_nombre", "fecha_inicio", "fecha_termino", "domicilio_trabajador", "email", "fono", "centro_trabajo", "area", "jornada", "empresa", "rut_empresa", "representante_legal", "rut_representante", "domicilio_empresa", "ciudad", "fecha_documento"];
const schema = {
  type: "object", additionalProperties: false,
  properties: {
    titulo: { type: "string" },
    tipo: { type: "string", enum: ["Contrato Indefinido", "Plazo Fijo", "Anexo de Obra", "Finiquito", "Otro"] },
    contenido: { type: "string" },
    variables: { type: "array", items: { type: "string", enum: allowedVariables } },
    advertencias: { type: "array", items: { type: "string" } }
  },
  required: ["titulo", "tipo", "contenido", "variables", "advertencias"]
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const started = Date.now();
  let db: ReturnType<typeof createClient> | null = null;
  let reservationId: string | undefined;
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!serviceKey || !openAIKey) return json({ error: "La lectura IA no está configurada." }, 503);
    db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Debes iniciar sesión para analizar documentos laborales." }, 401);

    const { text, file_base64, file_name, mime_type, empresa: requestedCompany } = await req.json();
    if (!requestedCompany) return json({ error: "Debes indicar la empresa activa." }, 400);
    if (!text && !file_base64) return json({ error: "Adjunta un PDF, DOCX o TXT con contenido legible." }, 400);

    const { data: profile } = await db.from("usuarios").select("usuario,nombre,correo,empresa,rol,rol_base,permisos").eq("auth_user_id", authData.user.id).eq("empresa", requestedCompany).maybeSingle();
    if (!profile) return json({ error: "Cuenta no autorizada para esta empresa." }, 403);
    const role = String(profile.rol_base || profile.rol || "").toLowerCase();
    const permissions = profile.permisos && typeof profile.permisos === "object" ? profile.permisos : {};
    const authorized = ["administrador", "admin", "superadmin", "superusuario", "gerencia"].some(item => role.includes(item)) || permissions["rrhh.personal.importar"] === true || permissions["rrhh.personal.configurar"] === true;
    if (!authorized) return json({ error: "Tu perfil no puede analizar formatos laborales." }, 403);

    const [{ data: globalConfig }, { data: companyConfig }] = await Promise.all([
      db.from("config_global_obraxis").select("ia_habilitada,ia_proveedor,ia_modelo,ia_archivo_max_mb").eq("id", 1).maybeSingle(),
      db.from("ia_config_empresas").select("habilitada,modelo,funciones").eq("empresa", profile.empresa).maybeSingle()
    ]);
    if (globalConfig?.ia_habilitada === false || companyConfig?.habilitada === false) return json({ error: "La IA está deshabilitada para esta empresa." }, 403);
    if (globalConfig?.ia_proveedor && String(globalConfig.ia_proveedor).toLowerCase() !== "openai") return json({ error: "El proveedor configurado no admite este análisis." }, 503);
    const functions = companyConfig?.funciones || {};
    if (functions.rrhh === false || functions.lectura_documental === false) return json({ error: "La IA documental de RR. HH. no está contratada para esta empresa." }, 403);

    const estimatedBytes = file_base64 ? Math.ceil(String(file_base64).length * .75) : new TextEncoder().encode(String(text)).length;
    const maxMb = Number(globalConfig?.ia_archivo_max_mb || 10);
    if (estimatedBytes > maxMb * 1024 * 1024) return json({ error: `El archivo supera el máximo de ${maxMb} MB.` }, 413);
    const model = companyConfig?.modelo || globalConfig?.ia_modelo || "gpt-4.1-mini";
    const { data: reserved, error: reserveError } = await db.rpc("ia_reservar_consumo", { p_empresa: profile.empresa, p_obra_nombre: "", p_auth_user_id: authData.user.id, p_usuario: profile.nombre || profile.usuario || profile.correo, p_funcion: "rrhh", p_modelo: model, p_reserva_usd: .08 });
    if (reserveError) return json({ error: reserveError.message }, 403);
    reservationId = reserved;

    const instructions = `Convierte el documento laboral chileno adjunto en una plantilla reutilizable. Transcribe y conserva fielmente títulos, numeración, cláusulas, párrafos y orden: no resumas, no modernices y no inventes disposiciones. Sustituye solamente datos variables visibles por etiquetas con doble llave tomadas de esta lista: ${allowedVariables.map(value => `{{${value}}}`).join(", ")}. No reemplaces texto fijo. Si una parte no es legible, indícalo entre [REVISAR TEXTO ILEGIBLE] y agrega una advertencia. Devuelve texto plano bien separado. La salida es una propuesta que será revisada por la empresa, no asesoría legal.`;
    const content: Record<string, unknown>[] = [{ type: "input_text", text: instructions }];
    if (text) content.push({ type: "input_text", text: `Nombre del archivo: ${file_name || "documento"}\n\nCONTENIDO:\n${String(text)}` });
    else if (String(mime_type).startsWith("image/")) content.push({ type: "input_image", image_url: `data:${mime_type};base64,${file_base64}` });
    else content.push({ type: "input_file", filename: file_name || "contrato.pdf", file_data: `data:${mime_type || "application/pdf"};base64,${file_base64}` });

    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${openAIKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, input: [{ role: "user", content }], text: { format: { type: "json_schema", name: "formato_laboral", strict: true, schema } } }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || "No fue posible analizar el documento.");
    const raw = result.output_text || result.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
    if (!raw) throw new Error("La IA no devolvió contenido utilizable.");
    const parsed = JSON.parse(raw);
    const inputTokens = Number(result.usage?.input_tokens || 0), outputTokens = Number(result.usage?.output_tokens || 0), cost = (inputTokens * .40 + outputTokens * 1.60) / 1_000_000;
    await db.rpc("ia_finalizar_consumo", { p_id: reservationId, p_estado: "Completado", p_tokens_entrada: inputTokens, p_tokens_salida: outputTokens, p_costo_usd: cost, p_confianza: null, p_duracion_ms: Date.now() - started, p_error_detalle: "", p_metadatos: { mime_type, bytes: estimatedBytes, file_name } });
    return json({ data: parsed, usage: { tokens_total: inputTokens + outputTokens, costo_usd: cost } });
  } catch (error) {
    if (reservationId && db) await db.rpc("ia_finalizar_consumo", { p_id: reservationId, p_estado: "Error", p_tokens_entrada: 0, p_tokens_salida: 0, p_costo_usd: 0, p_confianza: null, p_duracion_ms: Date.now() - started, p_error_detalle: error instanceof Error ? error.message : String(error), p_metadatos: {} });
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
