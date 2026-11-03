export function rentalCurrency(data) {
  const moneda_costo = data.moneda_costo || 'CLP';
  const costo_original = Number(String(data.costo).replace(',', '.'));
  const cambio_costo_clp = moneda_costo === 'CLP' ? 1 : Number(data.cambio_costo_clp);
  if (!['CLP', 'UF', 'USD'].includes(moneda_costo) || !Number.isFinite(costo_original) || costo_original < 0 || !Number.isFinite(cambio_costo_clp) || cambio_costo_clp <= 0) {
    throw new Error('Ingresa una tarifa válida y un valor de conversión mayor que cero.');
  }
  return { moneda_costo, costo_original, cambio_costo_clp, costo: costo_original * cambio_costo_clp };
}
