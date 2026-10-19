const supported=value=>['CLP','UF','USD'].includes(value)?value:'CLP';
const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
export const isBudgetHeading=p=>p.es_titulo||['TITULO','GRUPO'].includes(p.unidad);
export function budgetPriceView(p,{mode='clp',overrides={},projectCurrency='CLP',quotes={}}={}) {
  const hasOverride=Object.prototype.hasOwnProperty.call(overrides,p.partida);
  const base=Number(hasOverride?overrides[p.partida]:(p.pu??p.costo_por_dia??0));
  // Importaciones antiguas conservan su P.U. en la moneda del presupuesto maestro.
  const imported=p.presupuesto_item_id!=null&&!numeric(p.pu_original);
  const originalCurrency=imported?supported(projectCurrency):supported(p.moneda_pu||'CLP');
  const rate=originalCurrency==='CLP'?1:Number(p.cambio_pu_clp||quotes[originalCurrency]?.value||0);
  if(imported){
    return {currency:mode==='original'?originalCurrency:'CLP',unitPrice:mode==='original'||originalCurrency==='CLP'?base:rate>0?base*rate:null};
  }
  if(mode!=='original'||originalCurrency==='CLP')return {currency:'CLP',unitPrice:base};
  // Para partidas guardadas, jamás sustituir su conversión por el indicador de hoy.
  const savedRate=Number(p.cambio_pu_clp);
  const unitPrice=!hasOverride&&numeric(p.pu_original)?Number(p.pu_original):savedRate>0?base/savedRate:null;
  return {currency:originalCurrency,unitPrice};
}
export function budgetViewTotals(parts,options){
  const totals=new Map();
  for(const p of parts.filter(p=>!isBudgetHeading(p))){
    const {currency,unitPrice}=budgetPriceView(p,options);
    const quantity=Number(p.cantidad??p.cantidad_presupuestada??0);
    const previous=totals.get(currency)??0;
    totals.set(currency,unitPrice===null||totals.get(currency)===null?null:previous+quantity*unitPrice);
  }
  return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,amount])=>({currency,amount}));
}
export function formatBudgetViewAmount(amount,currency,{unit=false}={}){
  if(amount===null||!Number.isFinite(Number(amount)))return 'N/D';
  const value=Number(amount).toLocaleString('es-CL',{minimumFractionDigits:unit?2:0,maximumFractionDigits:unit?2:currency==='CLP'?0:currency==='UF'?4:2});
  return currency==='CLP'?`$${value}`:`${currency} ${value}`;
}
