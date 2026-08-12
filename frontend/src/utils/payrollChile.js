const num = value => Number(value || 0);
const round = value => Math.round(num(value));
const cleanRut = value => String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();

export const monthlyTax = (taxableIncome, utm) => {
  const income = Math.max(0, num(taxableIncome));
  const unit = num(utm);
  if (!unit) return 0;
  const brackets = [
    [13.5, 0, 0], [30, 0.04, 0.54], [50, 0.08, 1.74], [70, 0.135, 4.49],
    [90, 0.23, 11.14], [120, 0.304, 17.8], [150, 0.35, 23.32], [Infinity, 0.4, 30.82]
  ];
  const inUtm = income / unit;
  const bracket = brackets.find(([limit]) => inUtm <= limit) || brackets.at(-1);
  return Math.max(0, round(income * bracket[1] - unit * bracket[2]));
};

export const attendanceSummary = (worker, records, period) => {
  const rut = cleanRut(worker.rut);
  const relevant = records.filter(row => {
    const date = String(row.created_at || '').slice(0, 7);
    return date === period && (rut ? cleanRut(row.rut) === rut : String(row.trabajador || '').trim().toLowerCase() === String(worker.nombre || '').trim().toLowerCase());
  });
  const present = relevant.filter(row => /presente|asisti|trabaj/i.test(row.asistencia || '')).length;
  const absent = relevant.filter(row => /ausente|falta|inasist/i.test(row.asistencia || '')).length;
  const overtime = relevant.reduce((sum, row) => sum + num(row.horas_extras_manual ?? row.horas_extras_auto), 0);
  return { records: relevant.length, present, absent, overtime };
};

export const calculatePayroll = (worker, attendance, parameters, novelty = {}) => {
  const baseContract = num(worker.sueldo_base);
  const paidDays = Math.max(0, Math.min(30, novelty.dias_pagados === '' || novelty.dias_pagados == null ? (attendance.records ? 30 - attendance.absent : 30) : num(novelty.dias_pagados)));
  const base = round(baseContract * paidDays / 30);
  const minSalary = num(parameters.salarioMinimo);
  const gratificationCap = round(4.75 * minSalary / 12 * paidDays / 30);
  const gratification = worker.gratificacion === 'Sin Gratificación' ? 0 : Math.min(round(base * 0.25), gratificationCap);
  const weeklyHours = Math.max(1, num(parameters.horasSemanales || 44));
  const hourly = baseContract * 7 / (30 * weeklyHours);
  const overtimeHours = num(novelty.horas_extra ?? attendance.overtime);
  const overtime = round(hourly * 1.5 * overtimeHours);
  const bonus = round(novelty.bonos);
  const taxableGrossRaw = base + gratification + overtime + bonus;
  const pensionCap = num(parameters.topeAfpUf) * num(parameters.uf);
  const unemploymentCap = num(parameters.topeCesantiaUf) * num(parameters.uf);
  const pensionTaxable = Math.min(taxableGrossRaw, pensionCap || taxableGrossRaw);
  const unemploymentTaxable = Math.min(taxableGrossRaw, unemploymentCap || taxableGrossRaw);
  const afpRate = num(parameters.afpRates?.[String(worker.afp || '').replace('AFP ', '').trim()] ?? parameters.afpRates?.Habitat ?? 11.27);
  const afp = round(pensionTaxable * afpRate / 100);
  const healthPlan = num(novelty.plan_salud);
  const health = Math.max(round(pensionTaxable * 0.07), healthPlan);
  const indefinite = /indefinido/i.test(worker.tipo_contrato || 'Indefinido');
  const afc = indefinite ? round(unemploymentTaxable * 0.006) : 0;
  const taxableForTax = Math.max(0, taxableGrossRaw - afp - health - afc);
  const tax = monthlyTax(taxableForTax, parameters.utm);
  const collation = round(num(worker.colacion) * paidDays / 30);
  const transport = round(num(worker.movilizacion) * paidDays / 30);
  const otherNonTaxable = round(novelty.no_imponibles);
  const otherDiscounts = round(novelty.otros_descuentos);
  const legalDiscounts = afp + health + afc + tax;
  const totalAssets = taxableGrossRaw + collation + transport + otherNonTaxable;
  const net = Math.max(0, totalAssets - legalDiscounts - otherDiscounts);
  return { workerId: worker.id, rut: worker.rut, nombre: worker.nombre, obra: worker.obra_nombre, cargo: worker.cargo, paidDays, attendanceRecords: attendance.records, absentDays: attendance.absent, overtimeHours, baseContract, base, gratification, overtime, bonus, taxableGross: taxableGrossRaw, pensionTaxable, collation, transport, otherNonTaxable, totalAssets, afpRate, afp, health, afc, tax, legalDiscounts, otherDiscounts, net };
};
