import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set(["https://obraxis.cl", "https://www.obraxis.cl"]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://www.obraxis.cl",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
const respond = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
});

const budgetSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    proyecto: {
      type: "object",
      additionalProperties: false,
      properties: {
        nombre: { type: "string" }, cliente: { type: "string" },
        moneda_base: { type: "string", enum: ["CLP", "USD", "UF"] },
        comuna: { type: "string" }, plazo_estimado: { type: "integer" },
      },
      required: ["nombre", "cliente", "moneda_base", "comuna", "plazo_estimado"],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          codigo: { type: "string" }, descripcion: { type: "string" },
          is_chapter: { type: "boolean" }, unidad: { type: "string" },
          cantidad: { type: "number" }, costo_unitario: { type: "number" },
        },
        required: ["codigo", "descripcion", "is_chapter", "unidad", "cantidad", "costo_unitario"],
      },
    },
  },
  required: ["proyecto", "items"],
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return respond({ error: "Método no permitido." }, 405, origin);

  const startedAt = Date.now();
  let reservationId: string | undefined;
  let db: any;
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAIKey = Deno.env.get("OPENAI_API_KEY");
    if (!serviceKey || !openAIKey) return respond({ error: "La importación inteligente no está configurada en el servidor." }, 503, origin);
    db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });

    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData?.user) return respond({ error: "Debes iniciar sesión." }, 401, origin);

    const body = await req.json();
    const requestedCompany = String(body?.empresa || "").trim();
    let profileQuery = db.from("usuarios").select("usuario,nombre,correo,empresa,rol,rol_base,permisos").eq("auth_user_id", authData.user.id);
    if (requestedCompany) profileQuery = profileQuery.eq("empresa", requestedCompany);
    const { data: profiles, error: profileError } = await profileQuery.limit(2);
    if (profileError) throw profileError;
    if (!profiles?.length) return respond({ error: "La cuenta no está autorizada para esta empresa." }, 403, origin);
    const profile = profiles[0];

    const [{ data: globalConfig }, { data: companyConfig }] = await Promise.all([
      db.from("config_global_obraxis").select("ia_habilitada,ia_modelo,ia_archivo_max_mb").eq("id", 1).maybeSingle(),
      db.from("ia_config_empresas").select("habilitada,modelo,funciones").eq("empresa", profile.empresa).maybeSingle(),
    ]);
    if (globalConfig?.ia_habilitada === false || companyConfig?.habilitada === false) {
      return respond({ error: "La IA está deshabilitada para esta empresa." }, 403, origin);
    }
    if (companyConfig?.funciones?.importacion_presupuesto === false) {
      return respond({ error: "La importación de presupuestos con IA no está habilitada para esta empresa." }, 403, origin);
    }

    const mimeType = String(body?.mime_type || "");
    const fileName = String(body?.file_name || "presupuesto").slice(0, 180);
    const fileBase64 = String(body?.file_base64 || "");
    const textContent = String(body?.text_content || "");
    const allowedMime = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv"]);
    if (!allowedMime.has(mimeType) || (!fileBase64 && !textContent)) return respond({ error: "Archivo ausente o formato no permitido." }, 400, origin);
    const approximateBytes = fileBase64 ? Math.ceil(fileBase64.length * .75) : new TextEncoder().encode(textContent).length;
    const maxMb = Number(globalConfig?.ia_archivo_max_mb || 10);
    if (approximateBytes > maxMb * 1024 * 1024) return respond({ error: `El archivo supera el máximo de ${maxMb} MB.` }, 413, origin);

    const model = companyConfig?.modelo || globalConfig?.ia_modelo || "gpt-4.1-mini";
    const { data: reserved, error: reserveError } = await db.rpc("ia_reservar_consumo", {
      p_empresa: profile.empresa, p_obra_nombre: "", p_auth_user_id: authData.user.id,
      p_usuario: profile.nombre || profile.usuario || profile.correo,
      p_funcion: "lectura_documental", p_modelo: model, p_reserva_usd: .08,
    });
    if (reserveError) return respond({ error: reserveError.message }, 429, origin);
    reservationId = reserved;

    const instructions = "Interpreta este presupuesto de construcción. Conserva el orden y la jerarquía original. Marca títulos o capítulos con is_chapter=true, cantidad y costo_unitario en cero. Las partidas deben tener is_chapter=false. No inventes precios, cantidades, unidades ni datos del proyecto: usa vacío o cero cuando no estén presentes. Devuelve exclusivamente la estructura solicitada; una persona revisará todo antes de guardar.";
    const sourcePart = fileBase64
      ? (mimeType.startsWith("image/")
        ? { type: "input_image", image_url: `data:${mimeType};base64,${fileBase64}` }
        : { type: "input_file", filename: fileName, file_data: `data:${mimeType};base64,${fileBase64}` })
      : { type: "input_text", text: textContent.slice(0, 500000) };
    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: [{ role: "user", content: [{ type: "input_text", text: instructions }, sourcePart] }], text: { format: { type: "json_schema", name: "presupuesto_obra", strict: true, schema: budgetSchema } } }),
    });
    const apiData = await apiResponse.json();
    if (!apiResponse.ok) throw new Error(apiData?.error?.message || "No fue posible interpretar el presupuesto.");
    const raw = apiData.output_text || apiData.output?.flatMap((entry: any) => entry.content || []).find((entry: any) => entry.type === "output_text")?.text;
    if (!raw) throw new Error("La IA no devolvió información utilizable.");
    const result = JSON.parse(raw);
    if (!Array.isArray(result?.items) || result.items.length === 0) throw new Error("No se detectaron partidas en el archivo.");

    const inputTokens = Number(apiData.usage?.input_tokens || 0);
    const outputTokens = Number(apiData.usage?.output_tokens || 0);
    const estimatedCost = (inputTokens * .40 + outputTokens * 1.60) / 1_000_000;
    await db.rpc("ia_finalizar_consumo", {
      p_id: reservationId, p_estado: "Completado", p_tokens_entrada: inputTokens,
      p_tokens_salida: outputTokens, p_costo_usd: estimatedCost, p_confianza: null,
      p_duracion_ms: Date.now() - startedAt, p_error_detalle: "",
      p_metadatos: { file_name: fileName, mime_type: mimeType, bytes: approximateBytes, items: result.items.length },
    });
    return respond({ data: result, usage: { tokens_total: inputTokens + outputTokens, costo_usd: estimatedCost } }, 200, origin);
  } catch (error) {
    if (reservationId && db) await db.rpc("ia_finalizar_consumo", {
      p_id: reservationId, p_estado: "Error", p_tokens_entrada: 0, p_tokens_salida: 0,
      p_costo_usd: 0, p_confianza: null, p_duracion_ms: Date.now() - startedAt,
      p_error_detalle: error instanceof Error ? error.message : String(error), p_metadatos: {},
    });
    return respond({ error: error instanceof Error ? error.message : String(error) }, 400, origin);
  }
});
