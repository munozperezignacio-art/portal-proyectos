export function projectName(value) {
  const name=String(value??'').trim().replace(/\s+/g,' ');
  if(!name || name.length>150 || name.includes(',') || [...name].some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127) || ['todas','todos','*'].includes(name.toLowerCase())) {
    throw new Error('Ingresa un nombre de 1 a 150 caracteres, sin comas ni nombres reservados.');
  }
  return name;
}

export function renameWorkScope(scope,previous,next) {
  if(typeof scope!=='string')return scope;
  return scope.split(',').map(name=>name.trim().toLowerCase()===previous.toLowerCase()?next:name.trim()).join(',');
}

// La base de datos ya confirmó la operación. Un almacenamiento local lleno no debe
// convertirla en un falso error ni provocar un segundo guardado.
export function migrateProjectStorage(storage,previous,next) {
  try {
    const favorites=JSON.parse(storage.getItem('obraxis_favorites')||'[]');
    if(Array.isArray(favorites))storage.setItem('obraxis_favorites',JSON.stringify([...new Set(favorites.map(n=>n===previous?next:n))]));
    for(const prefix of ['obraxis_custom_salaries_','obraxis_asignaciones_periodos_']) {
      const data=storage.getItem(prefix+previous);
      if(data!==null){storage.setItem(prefix+next,data);storage.removeItem(prefix+previous);}
    }
  } catch { /* El servidor sigue siendo la fuente de verdad. */ }
}
