import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { recoverFromStaleChunk } from './utils/staleChunkRecovery';

// Los nombres de los archivos JS cambian en cada despliegue. Si una pestaña
// conserva una versión anterior, se solicita una sola vez el index vigente.
window.addEventListener('unhandledrejection', (event) => recoverFromStaleChunk(event.reason));
window.addEventListener('error', (event) => recoverFromStaleChunk(event.error || event.message));

const forceFreshReload = () => {
  const url = new URL(window.location.href);
  url.searchParams.set('__obraxis_reload', String(Date.now()));
  window.location.replace(url.toString());
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error no capturado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyCenter: 'center', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f87171' }}>⚠️ Error en la Aplicación</h2>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', color: '#94a3b8' }}>{this.state.error?.toString() || 'Ocurrió un error inesperado al cargar los datos.'}</p>
          <button
            onClick={forceFreshReload}
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
