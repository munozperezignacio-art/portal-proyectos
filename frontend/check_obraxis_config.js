import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wegphblwwcfidvdbdtdq.supabase.co';
const supabaseAnonKey = 'sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase
    .from('config_empresa')
    .select('empresa, email_sender, email_api_key')
    .eq('empresa', 'Obraxis')
    .maybeSingle();

  if (error) {
    console.error('Error querying Supabase:', error.message);
  } else {
    console.log('--- Configuración Obraxis ---');
    console.log('Empresa:', data?.empresa);
    console.log('Email Sender:', data?.email_sender);
    console.log('API Key configurada (primeros 5 caracteres):', data?.email_api_key ? data.email_api_key.substring(0, 5) + '...' : 'NO CONFIGURADA');
  }
}

check();
