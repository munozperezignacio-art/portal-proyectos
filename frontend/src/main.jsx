import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Vite da a cada despliegue nombres nuevos a los archivos JS. Si una pestaña
// abierta conserva la versión anterior, el import dinámico puede pedir un
// archivo que ya no existe. Recargamos una sola vez para obtener el index
// vigente, evitando dejar la obra bloqueada en una pantalla de error.
const RECENT_CHUNK_RELOAD_KEY = 'obraxis:last-stale-chunk-reload';
const STALE_CHUNK_PATTERN = /failed to fetch dynamically imported module|importing a module script failed/i;

const recoverFromStaleChunk = (reason) => {
  const message = reason instanceof Error
    ? reason.message
    : String(reason?.message || reason || '');

  if (!STALE_CHUNK_PATTERN.test(message)) return;

  try {
    const lastReload = Number(window.sessionStorage.getItem(RECENT_CHUNK_RELOAD_KEY) || 0);
    // Evita un ciclo de recargas si el problema no es una versión desactualizada.
    if (Date.now() - lastReload < 15_000) return;
    window.sessionStorage.setItem(RECENT_CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Si el almacenamiento no está disponible, igualmente intentamos recuperar la página.
  }

  window.location.reload();
};

window.addEventListener('unhandledrejection', (event) => recoverFromStaleChunk(event.reason));
window.addEventListener('error', (event) => recoverFromStaleChunk(event.error || event.message));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error no capturado:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyCenter: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f87171' }}>⚠️ Error en la Aplicación</h2>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#94a3b8' }}>{this.state.error?.toString() || 'Ocurrió un error inesperado al cargar los datos.'}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1.5rem', backgroundColor: '#2563eb', color: '#ffffff', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Reintentar / Cargar de Nuevo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
