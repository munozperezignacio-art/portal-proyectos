/**
 * Utility to format any Chilean RUT to standard format: XX.XXX.XXX-K
 * Handles inputs like: "123456789", "12.345.678k", "761234567", etc.
 */
export function formatRut(rut) {
  if (!rut) return '';
  
  // Clean all characters except 0-9, k, K
  let clean = rut.toString().replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  
  let dv = clean.slice(-1);
  let body = clean.slice(0, -1);
  
  // Format body with dots
  let formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formattedBody}-${dv}`;
}

/**
 * Clean RUT to numbers + DV without dots or dash (e.g., 12345678K)
 */
export function cleanRut(rut) {
  if (!rut) return '';
  return rut.toString().replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Formats numeric string or number with Chilean thousands dots (e.g., 1000000 -> 1.000.000)
 */
export function formatNumberWithDots(val) {
  if (val === undefined || val === null || val === '') return '';
  const str = val.toString().replace(/[^0-9]/g, '');
  if (!str) return '';
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses Chilean formatted string with dots back to plain integer
 */
export function parseNumberFromDots(val) {
  if (val === undefined || val === null || val === '') return 0;
  const clean = val.toString().replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}
