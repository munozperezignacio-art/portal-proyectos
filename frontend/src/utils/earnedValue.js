const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** Calcula indicadores determinísticos de Valor Ganado (EVM). */
export function calculateEarnedValue({ earnedValue, plannedValue, actualCost, budgetAtCompletion }) {
  const ev = Math.max(0, finiteNumber(earnedValue));
  const pv = Math.max(0, finiteNumber(plannedValue));
  const ac = Math.max(0, finiteNumber(actualCost));
  const bac = Math.max(0, finiteNumber(budgetAtCompletion));
  const cpi = ac > 0 ? ev / ac : null;
  const spi = pv > 0 ? ev / pv : null;
  const eac = cpi !== null && cpi > 0 ? Math.round(bac / cpi) : bac;
  return { ev, pv, ac, bac, cpi, spi, eac, costVariance: ev - ac, scheduleVariance: ev - pv };
}
