export const auditActor = (user = {}, action, estado, comentario = '', extra = {}) => ({
  accion: action,
  estado,
  comentario: comentario || null,
  nombre: extra.nombre || user?.nombre || user?.usuario || user?.email || 'Usuario autorizado',
  rut: extra.rut || user?.rut || 'No informado',
  cargo: extra.cargo || user?.cargo || user?.rol || 'No informado',
  empresa: extra.empresa || user?.empresa || 'No informada',
  medio: 'Sistema Obraxis',
  fecha_hora: new Date().toISOString(),
});

export const appendAudit = (previous, entry) => [...(Array.isArray(previous) ? previous : []), entry];
