/**
 * Utilidad de Gestión de Niveles de Usuario y Permisos en OBRAXIS
 * 
 * Nivel 0: Administración Obraxis (SuperAdmin Global - Control Total)
 * Nivel 1: Administración Empresa (Admin Empresa - Gestión total en su empresa, asigna submódulos y obras)
 * Nivel 2: Creador / Asignado (Jefe Proyecto - Modifica únicamente lo creado por él o lo asignado a él)
 * Nivel 3: Revisor / Supervisor (Supervisa y edita configuraciones/elementos asignados por Nivel 2)
 * Nivel 4: Capturador / Operativo (Terreno - Solo ingresa información, ve únicamente lo asignado)
 */

export const getUserLevel = (user) => {
  if (!user) return 0; // Si no hay objeto user explícito, conceder permisos Nivel 0 por defecto

  const rol = (user.rol_base || user.rol || user.perfil || '').toLowerCase();
  const nivelNum = user.nivel !== undefined && user.nivel !== null ? parseInt(user.nivel, 10) : null;

  if (nivelNum !== null && !isNaN(nivelNum) && nivelNum >= 0 && nivelNum <= 4) {
    return nivelNum;
  }

  // Nivel 0: Superusuario Obraxis / Nivel 0 / Superadmin
  if (
    rol.includes('superusuario') || 
    rol.includes('nivel 0') || 
    rol.includes('obraxis') || 
    rol.includes('superadmin') ||
    user.empresa === 'Obraxis' ||
    user.email === 'ignacio.munozperez@gmail.com'
  ) {
    return 0;
  }

  // Nivel 1: Admin Empresa / Gerencia
  if (rol.includes('administrador') || rol.includes('admin') || rol.includes('gerencia') || rol.includes('nivel 1')) {
    return 1;
  }

  // Nivel 2: Creador / Profesional / Jefe de Proyecto
  if (rol.includes('jefe') || rol.includes('profesional') || rol.includes('creador') || rol.includes('nivel 2')) {
    return 2;
  }

  // Nivel 3: Revisor / Supervisor
  if (rol.includes('supervisor') || rol.includes('revisor') || rol.includes('nivel 3')) {
    return 3;
  }

  // Nivel 4: Inspector / Operador / Capturador Terreno
  return 0; // Por defecto otorgar permisos si no hay rol explicito
};

export const getUserLevelLabel = (user) => {
  const level = getUserLevel(user);
  switch (level) {
    case 0: return 'Nivel 0: Administración Obraxis';
    case 1: return 'Nivel 1: Admin Empresa';
    case 2: return 'Nivel 2: Creador / Asignado';
    case 3: return 'Nivel 3: Revisor / Supervisor';
    case 4: return 'Nivel 4: Operativo / Terreno';
    default: return `Nivel ${level}`;
  }
};

/**
 * Evalúa si un usuario puede editar un elemento específico según su nivel
 */
export const canEditItem = (user, itemCreatorId, itemAssigneeId) => {
  const level = getUserLevel(user);
  if (level === 0 || level === 1) return true; // Nivel 0 y 1 pueden editar todo en su ámbito
  if (level === 4) return false; // Nivel 4 solo ingresa datos, no edita fichas ni estructuras

  const currentUserId = user?.id || user?.nombre || user?.rut || '';
  if (!currentUserId) return false;

  // Nivel 2 y 3: Puede editar si fue creado por él o asignado a él
  if (itemCreatorId && (itemCreatorId === currentUserId || itemCreatorId === user.nombre)) return true;
  if (itemAssigneeId && (itemAssigneeId === currentUserId || itemAssigneeId === user.nombre)) return true;

  return false;
};

/**
 * Evalúa si un usuario puede configurar los correos (engranaje ⚙️) del módulo
 */
export const canConfigureEmails = (user) => {
  const level = getUserLevel(user);
  return level <= 3; // Permitido para Nivel 0, Nivel 1, Nivel 2 y Nivel 3
};

/**
 * Evalúa si el usuario puede crear u ordenar nuevas obras
 */
export const canCreateObras = (user) => {
  const level = getUserLevel(user);
  return level <= 1; // Nivel 0 y Nivel 1 crean obras
};

/**
 * Evalúa si el usuario puede modificar y eliminar cualquier registro de obra (Nivel 0, 1 y 2)
 */
export const canModifyOrDeleteRecords = (user) => {
  const level = getUserLevel(user);
  return level <= 2; // Nivel 0, Nivel 1 y Nivel 2 pueden modificar y eliminar todos los registros
};


