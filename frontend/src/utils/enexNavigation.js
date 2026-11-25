// Fixed internal destination: never accept an arbitrary post-login redirect.
export const ENEX_PENDING_PATH = '/dashboard?modulo=combustibles';

export function isEnexPendingDestination(search = '') {
  return new URLSearchParams(search).get('modulo') === 'combustibles';
}

// Personal assignments are authorized by enex_my_pending / enex_charge_center
// against auth.uid(), not by access to the administrative machinery module.
export function canOpenPersonalFuel(user, preview = false) {
  return Boolean(user?.id && user?.empresa === 'EMINSG' && !preview);
}
