import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectRoot = resolve(frontendRoot, '..');
const readProjectFile = (...parts) => readFileSync(join(projectRoot, ...parts), 'utf8');

test('el webhook entrante valida la firma de Resend antes de procesar correo', () => {
  const source = readProjectFile('supabase', 'functions', 'resend-correo-entrante', 'index.ts');
  assert.match(source, /request\.text\(\)/);
  assert.match(source, /RESEND_INBOUND_WEBHOOK_SECRET/);
  assert.match(source, /resend\.webhooks\.verify/);
});

test('el webhook entrante es público en Supabase pero protege su propia autenticidad', () => {
  const config = readProjectFile('supabase', 'config.toml');
  assert.match(config, /\[functions\.resend-correo-entrante\][\s\S]*?verify_jwt\s*=\s*false/);
});

test('la bandeja no inyecta HTML de correos y responde mediante la función protegida', () => {
  const source = readProjectFile('frontend', 'src', 'components', 'ContactInbox.jsx');
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.match(source, /functions\.invoke\(['"]correo-bandeja['"]/);
});

test('el modelo de correo usa RLS y limita las columnas editables desde el navegador', () => {
  const migration = readProjectFile(
    'supabase',
    'migrations',
    '20260917205305_correo_interno_obraxis.sql'
  );
  assert.match(migration, /alter table public\.correo_conversaciones enable row level security/);
  assert.match(migration, /alter table public\.correo_mensajes enable row level security/);
  assert.match(migration, /grant update \(estado, responsable_auth_user_id, responsable_nombre, notas_internas, no_leidos\)/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete)[^;]*public\.correo_mensajes to authenticated/);
  assert.match(migration, /create trigger trg_contacto_publico_crea_correo/);
});
