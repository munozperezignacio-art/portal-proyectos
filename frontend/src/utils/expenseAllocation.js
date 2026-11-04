export const eligibleExpenseParts=parts=>parts.filter(p=>p.id&&!p.es_titulo&&!['TITULO','GRUPO'].includes(String(p.unidad||'').toUpperCase())&&!['TITULO','GRUPO'].includes(String(p.tipo_item||'').toUpperCase()));
export const partBudget=p=>Number(p.cantidad??p.cantidad_presupuestada)*Number(p.pu??p.costo_por_dia);
export function weightedExpenseParts(parts,ids){
 if(!ids.length)return [];
 const chosen=eligibleExpenseParts(parts).filter(p=>ids.map(String).includes(String(p.id))).sort((a,b)=>Number(a.id)-Number(b.id));
 if(chosen.length!==new Set(ids.map(String)).size)throw Error('Una partida seleccionada ya no está disponible.');
 const weights=chosen.map(partBudget);if(weights.some(n=>!Number.isFinite(n)||n<=0))throw Error('Todas las partidas seleccionadas deben tener presupuesto total mayor a cero.');
 const total=weights.reduce((s,n)=>s+n,0);let cumulative=0,last=0;
 return chosen.map((p,i)=>{cumulative+=weights[i];const next=i===chosen.length-1?10000:Math.round(cumulative/total*10000),percent=(next-last)/100;last=next;if(percent<=0)throw Error('La ponderación es demasiado pequeña. Revisa las partidas seleccionadas.');return {partida_id:Number(p.id),partida:p.partida,porcentaje:percent,presupuesto:weights[i]};});
}
