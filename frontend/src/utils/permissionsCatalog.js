export const PERMISSION_ACTIONS = [
  { id: 'ver', label: 'Ver' },
  { id: 'crear', label: 'Crear' },
  { id: 'editar', label: 'Editar' },
  { id: 'eliminar', label: 'Eliminar' },
  { id: 'enviar', label: 'Enviar' },
  { id: 'revisar', label: 'Revisar' },
  { id: 'aprobar', label: 'Aprobar' },
  { id: 'descargar', label: 'Descargar' },
  { id: 'configurar', label: 'Configurar' },
];

export const PERMISSIONS_CATALOG = [
  { id: 'obras', label: 'Obras', menus: [
    { id: 'ficha', label: 'Ficha de la obra', actions: ['ver', 'crear', 'editar', 'eliminar', 'configurar'] },
    { id: 'avances', label: 'Avances', actions: ['ver', 'crear', 'editar', 'eliminar', 'revisar', 'descargar'] },
    { id: 'gestion', label: 'Presupuesto, programación y costos', actions: ['ver', 'crear', 'editar', 'eliminar', 'descargar', 'configurar'] },
    { id: 'estados_pago', label: 'Estados de Pago', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
    { id: 'libro_obra', label: 'Libro de Obra', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
    { id: 'calidad', label: 'Calidad de obra', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
    { id: 'prevencion', label: 'Prevención de obra', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
    { id: 'personal', label: 'Personal, asistencia y cuadrillas', actions: ['ver', 'crear', 'editar', 'eliminar', 'descargar', 'configurar'] },
    { id: 'maquinaria', label: 'Maquinaria de obra', actions: ['ver', 'crear', 'editar', 'eliminar', 'descargar', 'configurar'] },
  ]},
  { id: 'presupuestos', label: 'Presupuestos', menus: [
    { id: 'presupuestos', label: 'Presupuestos y APU', actions: ['ver', 'crear', 'editar', 'eliminar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
  ]},
  { id: 'rrhh', label: 'Recursos Humanos', menus: [
    { id: 'personal', label: 'Personal y contratos', actions: ['ver', 'crear', 'editar', 'eliminar', 'descargar', 'configurar'] },
  ]},
  { id: 'maquinaria', label: 'Maquinaria y Equipos', menus: [
    { id: 'inventario', label: 'Inventario, asignaciones y mantenimiento', actions: ['ver', 'crear', 'editar', 'eliminar', 'revisar', 'descargar', 'configurar'] },
  ]},
  { id: 'bodega', label: 'Bodega e Inventario', menus: [
    { id: 'inventario', label: 'Bodegas, productos y movimientos', actions: ['ver', 'crear', 'editar', 'eliminar', 'revisar', 'descargar', 'configurar'] },
  ]},
  { id: 'prevencion', label: 'Prevención de Riesgos', menus: [
    { id: 'registros', label: 'Registros e inspecciones', actions: ['ver', 'crear', 'editar', 'eliminar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
    { id: 'procedimientos', label: 'Procedimientos', actions: ['ver', 'crear', 'editar', 'eliminar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
  ]},
  { id: 'acreditaciones', label: 'Acreditaciones', menus: [
    { id: 'subcontratos', label: 'Subcontratos y proveedores', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
  ]},
  { id: 'formularios', label: 'Formularios y Capacitaciones', menus: [
    { id: 'formularios', label: 'Formularios y respuestas', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'descargar', 'configurar'] },
  ]},
  { id: 'facturacion', label: 'Facturación', menus: [
    { id: 'documentos', label: 'Documentos tributarios', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'descargar', 'configurar'] },
  ]},
  { id: 'gastos', label: 'Rendición de Gastos', menus: [
    { id: 'rendiciones', label: 'Rendiciones, comprobantes y aprobación', actions: ['ver', 'crear', 'editar', 'eliminar', 'enviar', 'revisar', 'aprobar', 'descargar', 'configurar'] },
  ]},
  { id: 'admin', label: 'Panel de control', menus: [
    { id: 'usuarios', label: 'Usuarios y roles', actions: ['ver', 'crear', 'editar', 'eliminar', 'configurar'] },
    { id: 'permisos', label: 'Permisos y flujos', actions: ['ver', 'editar', 'configurar'] },
  ]},
];

export const permissionKey = (moduleId, menuId, actionId) => `${moduleId}.${menuId}.${actionId}`;

export const isSuperUser = user => {
  const role = String(user?.rol_base || user?.rol || '').toLowerCase();
  return role.includes('superusuario') || role.includes('superadmin') || (user?.empresa === 'Obraxis' && role.includes('admin'));
};

export const defaultPermission = (user, key) => {
  if (isSuperUser(user)) return true;
  const role = String(user?.rol_base || user?.rol || '').toLowerCase();
  const action = key.split('.').pop();
  if (role.includes('admin') || role.includes('gerencia')) return true;
  if (role.includes('jefe') || role.includes('profesional') || role.includes('creador')) {
    return !['aprobar', 'configurar'].includes(action);
  }
  if (role.includes('revisor') || role.includes('supervisor')) {
    return ['ver', 'revisar', 'aprobar', 'descargar'].includes(action);
  }
  return ['ver', 'crear'].includes(action);
};

export const can = (user, permissions, key) => {
  if (isSuperUser(user)) return true;
  if (Object.prototype.hasOwnProperty.call(permissions || {}, key)) return Boolean(permissions[key]);
  return defaultPermission(user, key);
};

export const mergePermissions = (...sources) => Object.assign({}, ...sources.filter(Boolean));
