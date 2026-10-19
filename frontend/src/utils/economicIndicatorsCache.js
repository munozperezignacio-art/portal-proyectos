import {chileanDate} from './currencyIndicator.js';
const KEY='obraxis_economic_indicators_v1';
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value));
export function createIndicatorCache({read,refresh,storage,now=()=>Date.now()}={}) {
  const rows=new Map();const reads=new Map();const refreshes=new Map();let restored=false;
  const remember=(items,persist=true)=>{
    for(const item of items||[]){
      const row={currency:item.moneda||item.currency,date:item.fecha||item.date,value:Number(item.valor??item.value),source:item.fuente||item.source};
      if(['UF','USD','UTM'].includes(row.currency)&&validDate(row.date)&&Number.isFinite(row.value)&&row.value>0&&row.value<10000000&&['mindicador.cl','indicadores.cl'].includes(row.source))rows.set(`${row.currency}:${row.date}`,row);
    }
    if(persist)try{storage?.setItem(KEY,JSON.stringify([...rows.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,500)));}catch{/* caché en memoria disponible */}
  };
  const restore=()=>{if(restored)return;restored=true;try{const saved=JSON.parse(storage?.getItem(KEY)||'[]');if(Array.isArray(saved))remember(saved,false);}catch{/* ignorar caché inválido */}};
  const peek=(currency,date=chileanDate())=>{
    restore();return [...rows.values()].filter(row=>row.currency===currency&&row.date<=date&&(currency==='UTM'?row.date.slice(0,7)===date.slice(0,7):(Date.parse(date)-Date.parse(row.date))/86400000<=7)).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  };
  const prefetch=async(date=chileanDate())=>{
    restore();const previous=reads.get(date);if(previous&&now()-previous.at<300000)return previous.promise;
    const promise=Promise.resolve().then(()=>read(date)).then(items=>{remember(items);return items;}).catch(error=>{reads.delete(date);throw error;});
    reads.set(date,{at:now(),promise});return promise;
  };
  const load=async(currency,{date=chileanDate()}={})=>{
    if(currency==='CLP')return {currency,value:1,date,source:'CLP'};
    if(!['UF','USD','UTM'].includes(currency))throw Error('Moneda no soportada');
    const immediate=peek(currency,date);
    if(immediate){void prefetch(date).catch(()=>{});return immediate;}
    try{await prefetch(date);}catch{/* un corte no invalida valores ya guardados */}
    const cached=peek(currency,date);if(cached)return cached;
    if(!refreshes.has(date))refreshes.set(date,Promise.resolve().then(()=>refresh(date)).then(items=>remember(items)).finally(()=>refreshes.delete(date)));
    await refreshes.get(date);
    const result=peek(currency,date);if(!result)throw Error('Aún no hay un indicador publicado y guardado para esta fecha.');return result;
  };
  return {peek,load,prefetch,remember};
}
const client=async()=> (await import('../supabaseClient')).supabase;
let storage;try{storage=globalThis.localStorage;}catch{/* almacenamiento restringido */}
export const economicIndicators=createIndicatorCache({storage,
  read:async date=>{
    const db=await client();const since=new Date(Date.parse(date)-40*86400000).toISOString().slice(0,10);
    const {data,error}=await db.from('indicadores_economicos_cache').select('moneda,fecha,valor,fuente').gte('fecha',since).lte('fecha',date).order('fecha',{ascending:false}).limit(200);
    if(error)throw error;return data||[];
  },
  refresh:async date=>{const db=await client();const {data,error}=await db.functions.invoke('indicadores-economicos',{body:{fecha:date}});if(error||data?.error)throw error||Error(data.error);return data?.data||[];}
});
export const loadEconomicIndicator=(currency,options)=>economicIndicators.load(currency,options);
export async function prefetchEconomicIndicators(){
  try{await economicIndicators.prefetch();await Promise.allSettled(['UF','USD','UTM'].map(currency=>economicIndicators.load(currency)));}catch{/* se reintenta al abrir un módulo */}
}
