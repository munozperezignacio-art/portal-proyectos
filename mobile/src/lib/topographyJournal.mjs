export const topographyFields = [
 ['cota_inicial','Cota inicial (m)'],['cota_final','Cota final (m)'],
 ['norte_real','Norte medido (m)'],['este_real','Este medido (m)'],['cota_real','Cota medida (NPT)'],
];
export function topographyPayload(element, row, date) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Indica una fecha válida: AAAA-MM-DD.');
 const values={};
 for(const [key] of topographyFields){
  const value=String(row[key]??'').trim().replace(',','.');
  if(value!==''&&!/^-?\d+(\.\d+)?$/.test(value))throw new Error(`Dato numérico inválido en pila ${element.numero}.`);
  values[key]=value;
 }
 if(values.cota_inicial===''||values.cota_final==='')throw new Error(`Completa las cotas inicial y final de la pila ${element.numero}.`);
 return {element_id:element.id,partida_id:element.partida_id,revision:row.baseRevision??element.revision_topografia,
  datos:{...(row.baseTopography??element.topografia??{}),...values,fecha_medicion:date}};
}
export function configuredPileParts(settings,parts){return settings.filter(s=>parts.some(p=>Number(p.id)===Number(s.partida_id)));}
