const RELOAD_KEY = 'obraxis:last-stale-chunk-reload';

export const STALE_CHUNK_PATTERN = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|load failed|expected a javascript(?:-or-wasm)? module script/i;

export const isStaleChunkError = (reason) => {
  const message = reason instanceof Error
    ? `${reason.name} ${reason.message}`
    : String(reason?.message || reason || '');

  return STALE_CHUNK_PATTERN.test(message);
};

export const recoverFromStaleChunk = (reason) => {
  if (!isStaleChunkError(reason)) return false;

  const now = Date.now();
  try {
    const lastReload = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (now - lastReload < 15_000) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // La recuperación también funciona cuando sessionStorage está bloqueado.
  }

  // reload() puede reutilizar el index anterior. Este parámetro obliga al
  // navegador y a la CDN a solicitar la versión vigente de la aplicación.
  const url = new URL(window.location.href);
  url.searchParams.set('__obraxis_reload', String(now));
  window.location.replace(url.toString());
  return true;
};
