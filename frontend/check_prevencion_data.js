import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wegphblwwcfidvdbdtdq.supabase.co';
const supabaseAnonKey = 'sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log('--- Formularios de Prevención ---');
  const { data: forms, error: err1 } = await supabase
    .from('prevencion_formularios')
    .select('id, titulo, correos_notificacion, created_at');

  if (err1) {
    console.error('Error fetching forms:', err1.message);
  } else {
    console.log(forms);
  }

  console.log('\n--- Últimas 3 Respuestas de Prevención ---');
  const { data: responses, error: err2 } = await supabase
    .from('prevencion_respuestas')
    .select('id, formulario_id, inspector, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (err2) {
    console.error('Error fetching responses:', err2.message);
  } else {
    console.log(responses);
  }
}

check();
