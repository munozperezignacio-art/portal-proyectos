import { supabase } from '../supabaseClient';

export const registrarEventoBitacora = async ({ empresa, obraNombre, categoria, accion, detalle, actor, fecha }) => {
  if (!obraNombre || !categoria || !accion) return;
  const { error } = await supabase.from('bitacora_eventos_obra').insert({
    empresa: empresa || 'Obraxis', obra_nombre: obraNombre, categoria, accion, detalle: detalle || null,
    actor: actor || 'Sistema', fecha: fecha || new Date().toISOString().slice(0, 10),
  });
  if (error) console.warn('No fue posible registrar el evento de bitácora:', error.message);
};
