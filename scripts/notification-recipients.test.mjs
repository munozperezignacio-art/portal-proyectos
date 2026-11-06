import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationRecipient, pushEnabled } from '../supabase/functions/_shared/notificationRecipients.mjs';
const profile = { id: 1, empresa: 'A', auth_user_id: 'author', obras: ' Obra 1 ', rol: 'Supervisor' };
const event = { empresa: 'A', destinatario: '1', obra_nombre: 'Obra 1', payload: { operational_event: true, push_enabled: true } };
test('direct operational event reaches authorized recipient without a rule', () => { assert.equal(notificationRecipient(event, profile), true); assert.equal(pushEnabled(event), true); });
test('author never receives own event', () => assert.equal(notificationRecipient({ ...event, payload: { ...event.payload, actor_auth_user_id: 'author' } }, profile), false));
test('cross-company and revoked work access are rejected', () => { assert.equal(notificationRecipient({ ...event, empresa: 'B' }, profile), false); assert.equal(notificationRecipient(event, { ...profile, obras: 'Otra' }), false); });
test('unknown direct legacy events do not enable push implicitly', () => assert.equal(pushEnabled({ ...event, payload: {} }), false));
test('disabled rule is not dispatched', () => assert.equal(pushEnabled({ ...event, notificaciones_reglas: { activa: false, canal_push: true } }), false));
test('role rule respects assigned works', () => {
 const rule = { activa: true, destinatarios_roles: ['Supervisor'], condiciones: { alcance_tipo: 'asignadas' } };
 assert.equal(notificationRecipient({ ...event, destinatario: '', notificaciones_reglas: rule }, profile), true);
 assert.equal(notificationRecipient({ ...event, destinatario: '', obra_nombre: 'Otra', notificaciones_reglas: rule }, profile), false);
});
