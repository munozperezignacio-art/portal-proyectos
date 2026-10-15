export const selectableAllocationRows=(rows,today)=>rows.filter(row=>row.estado==='Pendiente' && row.fecha<=today);

export function allocationApprovalDecisions(rows,edits,ids,{today,commonReason}={}) {
  const selected=[...new Set(ids)];
  if(!selected.length || selected.length>1000)throw new Error('Seleccione entre 1 y 1.000 días por lote.');
  const batch=commonReason!==undefined,reason=String(commonReason ?? '').trim();
  if(batch && reason.length<3)throw new Error('Escriba un motivo común de al menos 3 caracteres.');
  return selected.map(id=>{
    const row=rows.find(r=>r.id===id);if(!row)throw new Error('La selección cambió. Actualice las propuestas y vuelva a seleccionar.');
    if(row.fecha>today)throw new Error('El lote incluye fechas futuras. Quite esos días de la selección.');
    if(row.costo_detalle?.listo===false)throw new Error(`${row.fecha}: ${row.costo_detalle.motivo || 'Falta configuración de costo'}. Revise «Parámetros de costeo mensual» y la ficha del trabajador; luego actualice las propuestas.`);
    const edit=edits[id] || {};
    const decision={id:row.id,evidencia:row.evidencia,costo_evidencia:row.costo_evidencia,
      horas_extra:Number(edit.hours ?? row.costo_detalle?.horas_extra ?? 0),
      haber_imponible:Number(edit.taxable ?? row.haber_imponible ?? 0),
      haber_no_imponible:Number(edit.nonTaxable ?? row.haber_no_imponible ?? 0),
      centro_id:Number(edit.center ?? row.centro_aprobado_id ?? row.centro_propuesto_id)||null,
      comentario:batch ? reason : String(edit.comment || '').trim()};
    if(!decision.centro_id)throw new Error('Seleccione un centro de destino para todos los días del lote.');
    if([decision.horas_extra,decision.haber_imponible,decision.haber_no_imponible].some(value=>!Number.isFinite(value) || value<0))throw new Error('Revise las horas extras y haberes del lote: deben ser números mayores o iguales a cero.');
    return decision;
  });
}
