import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});
const digest = async (value: string) => Array.from(
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))),
).map(byte => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const genericError = "Usuario, empresa o contraseña incorrectos.";
  try {
    const { usuario, empresa, password } = await req.json();
    const cleanUser = String(usuario || "").trim().toLowerCase();
    const cleanCompany = String(empresa || "").trim().toLowerCase();
    if (!cleanUser || !cleanCompany || !password) return json({ error: genericError }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = await digest(`${ip}|${cleanCompany}|${cleanUser}`);
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await service.from("auth_login_intentos").select("id", { count: "exact", head: true })
      .eq("clave_hash", key).eq("exitoso", false).gte("created_at", since);
    if ((count || 0) >= 5) return json({ error: "Demasiados intentos. Espera 15 minutos antes de volver a intentar." }, 429);

    const { data: profile } = await service.from("usuarios").select("correo")
      .ilike("usuario", cleanUser).ilike("empresa", cleanCompany).maybeSingle();
    if (!profile?.correo) {
      await service.from("auth_login_intentos").insert({ clave_hash: key, exitoso: false });
      return json({ error: genericError }, 401);
    }

    const { data, error } = await authClient.auth.signInWithPassword({ email: profile.correo, password: String(password) });
    await service.from("auth_login_intentos").insert({ clave_hash: key, exitoso: !error });
    if (error || !data.session) return json({ error: genericError }, 401);
    await service.from("auth_login_intentos").delete().eq("clave_hash", key).eq("exitoso", false);
    await service.from("auth_login_intentos").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
    });
  } catch {
    return json({ error: genericError }, 401);
  }
});

