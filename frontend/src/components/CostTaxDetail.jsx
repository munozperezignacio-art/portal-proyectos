import React from 'react';

const pesos = new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
export default function CostTaxDetail({cost}){
  if(cost.monto==='' || cost.monto==null)return null;
  const net=Number(cost.monto);
  const imported=Boolean(cost.factura_documento_id);
  const invoice=cost.asociar_factura===true || cost.asociar_factura==='SI';
  if(!imported&&!invoice)return <small className="block text-slate-500">IVA no informado</small>;
  const iva=imported?Number(cost.monto_iva):Math.round(net*19/100);
  const total=imported?Number(cost.monto_total):net+iva;
  return <div className="mt-1 space-y-1 text-[11px] font-normal text-slate-600">
    <div>{imported?'IVA del documento':'IVA estimado (19%)'}: {pesos.format(iva)}</div>
    <div>{imported?'Total documento':'Total estimado'}: {pesos.format(total)}</div>
  </div>;
}
