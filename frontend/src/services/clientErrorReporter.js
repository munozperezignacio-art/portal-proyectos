import { supabase } from '../supabaseClient';

const recentlyReported = new Map();
const DEDUPE_WINDOW_MS = 30_000;

const errorDetails = value => {
  if (value instanceof Error) return { message: value.message, stack: value.stack || '' };
  return { message: String(value || 'Error no identificado'), stack: '' };
};

export async function reportClientError(value, component = '') {
  const { message, stack } = errorDetails(value);
  const signature = `${message}|${component}|${window.location.pathname}`;
  const now = Date.now();
  if (now - (recentlyReported.get(signature) || 0) < DEDUPE_WINDOW_MS) return;
  recentlyReported.set(signature, now);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.rpc('registrar_error_cliente', {
      p_mensaje: message,
      p_stack: stack,
      p_contexto: {
        ruta: `${window.location.pathname}${window.location.search}`,
        componente: component,
        version: import.meta.env.VITE_APP_VERSION || ''
      }
    });
  } catch {
    // La telemetría nunca debe bloquear la recuperación ni generar otro error.
  }
}
