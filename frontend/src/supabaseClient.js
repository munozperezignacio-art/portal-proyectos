import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("tu-proyecto")) {
  console.warn("Advertencia: Las credenciales de Supabase no están configuradas correctamente en el archivo .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
