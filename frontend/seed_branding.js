import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wegphblwwcfidvdbdtdq.supabase.co';
const supabaseAnonKey = 'sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const __dirname = path.resolve();

async function start() {
  console.log('Iniciando sembrado de branding...');
  
  // 1. Leer Reports.gs para extraer el logo base64
  const reportsPath = path.join(__dirname, '../Reports.gs');
  if (!fs.existsSync(reportsPath)) {
    console.error('❌ No se encontró el archivo Reports.gs');
    return;
  }

  const content = fs.readFileSync(reportsPath, 'utf8');
  const match = content.match(/var\s+LOGO_BASE64\s*=\s*"([^"]+)"/);
  
  if (!match) {
    console.error('❌ No se pudo encontrar la variable LOGO_BASE64 en Reports.gs');
    return;
  }

  const rawBase64 = match[1];
  const logoDataUri = `data:image/png;base64,${rawBase64}`;

  // 2. Sembrar en Supabase
  const configEmin = {
    empresa: 'EMIN',
    logo_base64: logoDataUri,
    color_primario: '#1e3a8a', // EMIN blue
    color_secundario: '#1d4ed8' // EMIN blue hover (secondary)
  };

  console.log('Insertando configuración de marca para "EMIN" en Supabase...');
  
  const { error } = await supabase
    .from('config_empresa')
    .upsert([configEmin], { onConflict: 'empresa' });

  if (error) {
    console.error('❌ Error al insertar branding:', error.message);
  } else {
    console.log('✅ ¡Marca "EMIN" configurada e insertada con éxito en la base de datos!');
  }
}

start();
