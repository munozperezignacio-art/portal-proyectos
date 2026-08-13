import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authorization = req.headers.get("Authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Debes iniciar sesión para analizar documentos laborales." }, 401);

    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return json({ error: "La lectura IA requiere configurar OPENAI_API_KEY en Supabase Edge Functions." }, 503);
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const db = serviceKey ? createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } }) : null;
    const { data: config } = db ? await db.from("config_global_obraxis").select("ia_habilitada,ia_proveedor,ia_modelo,ia_archivo_max_mb").eq("id", 1).maybeSingle() : { data: null };
    if (config?.ia_habilitada === false) return json({ error: "Las funciones de IA están deshabilitadas globalmente." }, 503);
    if (config?.ia_proveedor && String(config.ia_proveedor).toLowerCase() !== "openai") return json({ error: `El proveedor ${config.ia_proveedor} no está disponible para documentos laborales.` }, 503);

    const { text, file_base64, file_name, mime_type } = await req.json();
    if (!text && !file_base64) throw new Error("Adjunta un PDF, DOCX o TXT con contenido legible.");
    const estimatedBytes = file_base64 ? Math.ceil(String(file_base64).length * .75) : new TextEncoder().encode(String(text)).length;
    const maxMb = Number(config?.ia_archivo_max_mb || 10);
    if (estimatedBytes > maxMb * 1024 * 1024) throw new Error(`El archivo supera el máximo global de ${maxMb} MB.`);

    const allowedVariables = ["nombre_trabajador", "rut", "cargo", "sueldo_base", "obra_nombre", "fecha_inicio", "fecha_termino", "domicilio_trabajador", "email", "fono", "centro_trabajo", "area", "jornada", "empresa", "rut_empresa", "representante_legal", "rut_representante", "domicilio_empresa", "ciudad", "fecha_documento"];
    const schema = { type: "object", additionalProperties: false, properties: {
      titulo: { type: "string" }, tipo: { type: "string", enum: ["Contrato Indefinido", "Plazo Fijo", "Anexo de Obra", "Finiquito", "Otro"] },
      contenido: { type: "string" }, variables: { type: "array", items: { type: "string", enum: allowedVariables } },
      advertencias: { type: "array", items: { type: "string" } }
    }, required: ["titulo", "tipo", "contenido", "variables", "advertencias"] };
    const instructions = `Convierte el documento laboral chileno adjunto en una plantilla reutilizable. Transcribe y conserva fielmente títulos, numeración, cláusulas, párrafos y orden: no resumas, no modernices y no inventes disposiciones. Sustituye solamente datos variables visibles por etiquetas con doble llave tomadas de esta lista: ${allowedVariables.map(v => `{{${v}}}`).join(", ")}. No reemplaces texto fijo. Si una parte no es legible, indícalo entre [REVISAR TEXTO ILEGIBLE] y agrega una advertencia. Devuelve texto plano bien separado. La salida es una propuesta que será revisada por la empresa, no asesoría legal.`;
    const content: any[] = [{ type: "input_text", text: instructions }];
    if (text) content.push({ type: "input_text", text: `Nombre del archivo: ${file_name || "documento"}\n\nCONTENIDO:\n${String(text)}` });
    else if (String(mime_type).startsWith("image/")) content.push({ type: "input_image", image_url: `data:${mime_type};base64,${file_base64}` });
    else content.push({ type: "input_file", filename: file_name || "contrato.pdf", file_data: `data:${mime_type || "application/pdf"};base64,${file_base64}` });

    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config?.ia_modelo || "gpt-4.1-mini", input: [{ role: "user", content }], text: { format: { type: "json_schema", name: "formato_laboral", strict: true, schema } } }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || "No fue posible analizar el documento.");
    const raw = result.output_text || result.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
    if (!raw) throw new Error("La IA no devolvió contenido utilizable.");
    return json({ data: JSON.parse(raw) });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400); }
});
