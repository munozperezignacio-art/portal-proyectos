export const REQUEST_CATEGORIES = ['Carga de combustible', 'Traslado de equipos', 'Materiales', 'Insumos de bodega', 'Elementos de protección personal'];
export const REQUEST_STATES = ['Pendiente', 'En revisión', 'Aprobada', 'Rechazada', 'Completada'];
export const isRequestClosed = state => ['Rechazada', 'Completada'].includes(state);
export const requestTransitions = state => ({ Pendiente: ['En revisión', 'Aprobada', 'Rechazada'], 'En revisión': ['Aprobada', 'Rechazada'], Aprobada: ['Completada'] }[state] || []);
