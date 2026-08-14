import assert from 'node:assert/strict';

const base = process.env.SUPABASE_FUNCTIONS_URL || 'https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1';
const cases = [
  ['documento-publico', [400]],
  ['asistencia-publica', [404]],
  ['portal-cliente', [400]],
  ['portal-mandante', [400]],
  ['subcontrato-operacion', [401]],
  ['enviar-correo-sistema', [401]],
  ['copiloto-obra', [401]],
  ['login-usuario', [401]],
  ['formulario-publico', [404]],
  ['capacitacion-publica', [404]],
  ['maquinaria-publica', [404]],
];

for (const [name, expected] of cases) {
  const response = await fetch(`${base}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.ok(expected.includes(response.status), `${name}: se esperaba ${expected.join('/')} y respondió ${response.status}`);
  console.log(`✓ ${name}: ${response.status}`);
}
