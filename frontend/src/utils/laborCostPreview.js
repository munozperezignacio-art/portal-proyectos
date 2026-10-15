export function laborCostPreview(detail, edits, worker, parameters) {
  if (!detail?.listo) return detail || {};
  parameters=detail.parametros_aplicados || parameters;
  const round2=n=>Math.round(n*100)/100;
  const hours=Math.max(0,Number(edits?.hours ?? detail.horas_extra)||0);
  const taxable=Math.max(0,Number(edits?.taxable ?? detail.haber_imponible)||0);
  const nonTaxable=Math.max(0,Number(edits?.nonTaxable ?? detail.haber_no_imponible)||0);
  const overtime=round2(Number(worker?.sueldo_base)*7/(30*Number(parameters.horas_semanales))*Number(parameters.factor_hora_extra)*hours);
  const gratification=detail.provision_referencial && worker?.gratificacion!=='Sin Gratificación'
    ? round2(Math.min((detail.base+overtime+taxable)*.25,Number(parameters.tope_gratificacion_mensual)/30)) : detail.gratificacion;
  const charges=round2((detail.base+gratification+overtime+taxable)*Number(parameters.cargas_empleador_pct)/100);
  return {...detail,gratificacion:gratification,horas_extra:hours,monto_horas_extra:overtime,haber_imponible:taxable,haber_no_imponible:nonTaxable,cargas_empleador:charges,
    total:Math.round(detail.base+gratification+detail.colacion+detail.movilizacion+overtime+taxable+nonTaxable+charges)};
}
