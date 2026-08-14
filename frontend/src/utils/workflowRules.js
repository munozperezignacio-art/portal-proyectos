const normalize = value => String(value || '').trim().toLowerCase();

export function paymentDispatchType(status) {
  const current = normalize(status);
  if (current === 'en aprobación') return 'aprobacion';
  if (['aprobado', 'pagado', 'rechazado'].includes(current)) return null;
  return 'revision';
}

export function canDispatchPayment(status, requestedType) {
  return paymentDispatchType(status) === requestedType;
}

const NC_SEQUENCE = ['abierta', 'en corrección', 'verificada', 'cerrada'];
const NC_LABELS = ['Abierta', 'En corrección', 'Verificada', 'Cerrada'];

export function nextNonConformityState(status) {
  const index = NC_SEQUENCE.indexOf(normalize(status));
  if (index < 0 || index === NC_SEQUENCE.length - 1) return null;
  return NC_LABELS[index + 1];
}

export function canTransitionNonConformity(from, to) {
  return nextNonConformityState(from) === to;
}

export function allowedBookActions(status) {
  const actions = { emitido: ['autorizar'], autorizado: ['enviar_cliente'], 'observado por cliente': ['modificar_reenviar', 'aceptar_comentarios'], 'aceptado por cliente': ['cerrar'] };
  return actions[normalize(status)] || [];
}
