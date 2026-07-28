import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wegphblwwcfidvdbdtdq.supabase.co';
const supabaseAnonKey = 'sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function start() {
  const newUser = {
    usuario: 'admin.obraxis',
    empresa: 'Obraxis',
    contrasena: 'Obraxis.Admin.2026!',
    rol: 'Superusuario',
    obras: 'TODAS',
    modulos: 'obras,rrhh,maquinaria,prevencion,admin',
    correo: 'contacto@obraxis.cl'
  };

  console.log('Insertando superusuario de Obraxis en la base de datos...');
  const { data, error } = await supabase
    .from('usuarios')
    .upsert([newUser], { onConflict: 'usuario' });

  if (error) {
    console.error('❌ Error al insertar usuario:', error.message);
  } else {
    console.log('✅ ¡Usuario Superusuario "admin.obraxis" creado con éxito!');
  }
}

start();
