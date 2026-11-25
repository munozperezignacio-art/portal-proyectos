import test from 'node:test';
import assert from 'node:assert/strict';
import {canOpenPersonalFuel, isEnexPendingDestination, ENEX_PENDING_PATH} from '../src/utils/enexNavigation.js';
import {renderEnexPendingEmail} from '../../supabase/functions/_shared/enexPendingEmail.mjs';

test('personal fuel is independent of administration permissions but authenticated, tenant scoped and not role preview', () => {
  for (const rol of ['Supervisor', 'Oficina Técnica', 'Administrador de Empresa']) {
    assert.equal(canOpenPersonalFuel({id: 1, empresa: 'EMINSG', rol, modulos: '', permisos: {}}), true);
  }
  assert.equal(canOpenPersonalFuel(null), false);
  assert.equal(canOpenPersonalFuel({empresa: 'EMINSG'}), false);
  assert.equal(canOpenPersonalFuel({id: 1, empresa: 'OTHER'}), false);
  assert.equal(canOpenPersonalFuel({id: 1, empresa: 'EMINSG'}, true), false);
});

test('email points to the fixed authenticated destination, without identifiers or open redirects', () => {
  const mail = renderEnexPendingEmail({company:'EMINSG', name:'Test', count:1, vehicles:[{vehicle:'TEST',portal:'empresa',count:1}], day:'2026-11-25', oldest:'2026-11-24'});
  assert.ok(mail.html.includes(`href="https://www.obraxis.cl${ENEX_PENDING_PATH}"`));
  assert.ok(mail.text.includes(`https://www.obraxis.cl${ENEX_PENDING_PATH}`));
  assert.equal(isEnexPendingDestination(new URL(`https://www.obraxis.cl${ENEX_PENDING_PATH}`).search), true);
  assert.equal(isEnexPendingDestination('?redirect=https://example.invalid'), false);
  assert.equal(isEnexPendingDestination('?modulo=admin'), false);
  assert.equal(isEnexPendingDestination(''), false);
});
