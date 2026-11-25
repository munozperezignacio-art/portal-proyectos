// Derived rows are for calculations only. Never persist or edit them as reports.
export function resolveWorkDependencies(parts,budget) {
 const match=(p,b)=>p.presupuesto_item_id!=null?String(p.presupuesto_item_id)===String(b.id):String(p.partida).trim().toLowerCase()===String(b.partida).trim().toLowerCase();
 return parts.map(p=>{
  if(p.avance_referencia_propia)return p;
  const candidates=budget.filter(b=>match(p,b));
  if(candidates.length!==1){if(candidates.some(b=>b.avance_depende_de))throw Error(`La partida ${p.partida} tiene más de una coincidencia en el presupuesto`);return p;}
  const b=candidates[0];if(!b.avance_depende_de)return p;
  const source=budget.find(x=>String(x.id)===String(b.avance_depende_de));
  const sources=source?parts.filter(x=>match(x,source)):[];
  if(sources.length!==1)throw Error(`Vincula sin ambigüedad la partida de referencia de ${p.partida} a esta obra`);
  return {...p,avance_depende_de:sources[0].id};
 });
}
export function dependentProgress(parts, reports) {
 const byId=new Map(parts.map(p=>[String(p.id),p]));
 const cache=new Map();
 const quantity=p=>Number(p.cantidad_presupuestada ?? p.cantidad)||0;
 function rows(p,path=new Set()) {
  const key=String(p.id);
  if(cache.has(key))return cache.get(key);
  if(path.has(key))throw Error('Dependencia circular de avance');
  const next=new Set(path);next.add(key);
  let result;
  if(p.avance_depende_de) {
   const source=byId.get(String(p.avance_depende_de));
   if(!source||quantity(source)<=0)throw Error('La partida de referencia debe existir y tener cantidad positiva');
   result=rows(source,next).map(r=>({...r,id:`dependiente:${key}:${r.id}`,partida_id:p.id,partida:p.partida,unidad:p.unidad,cantidad:Number(r.cantidad)*quantity(p)/quantity(source),avance_derivado:true}));
  } else result=reports.filter(r=>r.partida_id!=null?String(r.partida_id)===key:String(r.partida).trim().toLowerCase()===String(p.partida).trim().toLowerCase());
  cache.set(key,result);return result;
 }
 return [...reports,...parts.filter(p=>p.avance_depende_de).flatMap(p=>rows(p))];
}
export function inheritProgressPlan(parts) {
 const cache=new Map();
 const resolve=(p,path=[])=>{
  if(cache.has(p.id))return cache.get(p.id);
  if(path.includes(p.id))throw Error('Dependencia circular de avance');
  if(!p.avance_depende_de)return p;
  const source=parts.find(x=>String(x.id)===String(p.avance_depende_de));
  if(!source)throw Error('Falta la referencia del avance');
  const s=resolve(source,[...path,p.id]);
  const sourceQuantity=Number(s.cantidad_presupuestada??s.cantidad);
  const quantity=Number(p.cantidad_presupuestada??p.cantidad);
  if(!(sourceQuantity>0)||!(quantity>0))throw Error('Ambas partidas deben tener cantidad positiva');
  const sourceRate=Number(s.rendimiento_meta||s.rendimiento||0);
  const duration=Number(s.duracion_programada)>0?Number(s.duracion_programada):sourceRate>0?Math.max(1,Math.ceil(sourceQuantity/sourceRate)):null;
  const rate=duration?quantity/duration:0;
  const result={...p,fecha_inicio:s.fecha_inicio,fecha_termino:s.fecha_termino,duracion_programada:duration,rendimiento:rate,rendimiento_meta:rate,origen_planificacion:`Proporcional a ${s.partida}`};
  cache.set(p.id,result);return result;
 };
 return parts.map(p=>resolve(p));
}
