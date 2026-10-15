// The server supplies effective-dated rules; never fetch today's rates for old payroll.
export function laborCostParameters(worker,config={}) {
  if(config?.origen!=='Automático')return config || {};
  const r=config.reglas || {};
  const indefinite=/^indefinido$/i.test(worker.tipo_contrato || '');
  return {...config,horas_semanales:Number(worker.horas_semanales || config.horas_semanales),
    cargas_empleador_pct:Math.round((Number(r.aporte_previsional_pct)+Number(r.accidentes_basica_pct)+Number(r.sanna_pct)+Number(indefinite?r.afc_indefinido_pct:r.afc_plazo_pct))*100)/100};
}
