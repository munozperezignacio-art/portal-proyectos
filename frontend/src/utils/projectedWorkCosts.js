import {dailyTimeRate} from './workReportCalculations.js';
import {addSimulationDays,simulationDates,validSimulationDate} from './projectSimulator.js';

export function projectedCostResources(items,parts,start){
 return parts.filter(p=>!p.es_titulo&&!['TITULO','GRUPO'].includes(p.unidad)).flatMap(p=>{
  const name=p.name||p.partida,id=String(p.id??name);
  const matching=items.filter(c=>c.partida_id!=null?String(c.partida_id)===id:c.partida===name);
  const rows=matching.length?matching:[{id:`default-${id}`,nombre_item:'Referencia operativa predeterminada',tipo_proyeccion:'TIEMPO',tarifa_tiempo_dia:20000,referencia:true}];
  return rows.map(c=>({id:`projection-${c.id}`,name:c.nombre_item||'Costo proyectado',partId:id,partName:name,start:p.start>start?p.start:start,end:'',untilFinish:true,fromProjection:true,
   mode:c.tipo_proyeccion==='TIEMPO'?'workday':'units',rate:c.tipo_proyeccion==='TIEMPO'?dailyTimeRate(c):Number(c.precio_unitario_insumo),quantity:c.tipo_proyeccion==='TIEMPO'?1:Number(c.tasa_rendimiento_insumo),
   source:c.referencia?'Referencia predeterminada · $20.000 por día laborable y partida · no es un gasto real':'Costo proyectado guardado · '+(c.periodicidad==='Mes'?'tarifa mensual / 30':c.tipo_proyeccion==='TIEMPO'?'tarifa diaria':'consumo por unidad producida')}));
 });
}

export function scheduledProjectedCosts({items,parts,cutoff,baselineFinish,holidays=[]}){
 if(items==null)return [];
 const start=addSimulationDays(cutoff,1),holidaySet=new Set(holidays),result=[];
 for(const r of projectedCostResources(items,parts,start)){
  const p=parts.find(p=>String(p.id??p.partida)===r.partId);
  const finish=p.finish||baselineFinish,begin=p.start;
  if(!validSimulationDate(begin)||!validSimulationDate(finish)||finish<begin||finish<=cutoff)continue;
  const days=simulationDates(begin,finish).filter(d=>![0,6].includes(new Date(d+'T12:00:00Z').getUTCDay())&&!holidaySet.has(d));
  const dailyProduction=days.length?Number(p.quantity??p.cantidad??p.cantidad_presupuestada)/days.length:0;
  for(const date of days.filter(d=>d>cutoff))result.push({id:`${r.id}-${date}`,fecha:date,nombre:r.name,partida:p.partida,partida_id:p.id,monto:Math.round(r.rate*r.quantity*(r.mode==='units'?dailyProduction:1)),categoria_proyeccion:'Costos proyectados de partidas',origen_costo:r.source,estado_costo:'proyectado'});
 }
 return result;
}
