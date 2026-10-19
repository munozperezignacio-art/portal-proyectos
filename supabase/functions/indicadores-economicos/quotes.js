export const codes={UF:'uf',USD:'dolar',UTM:'utm'};
export const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function normalizeSeries(payload,currency,today=day()){
  if(payload?.codigo!==codes[currency]||!Array.isArray(payload.serie))return [];
  const maxDate=new Date(Date.parse(today)+45*86400000).toISOString().slice(0,10);
  return payload.serie.map(row=>({moneda:currency,fecha:String(row.fecha||'').slice(0,10),valor:Number(row.valor),fuente:'mindicador.cl'}))
    .filter(row=>validDate(row.fecha)&&row.fecha<=maxDate&&Number.isFinite(row.valor)&&row.valor>0&&row.valor<10000000);
}
export function alternativeQuotes(payload,today=day()){
  return Object.entries(codes).map(([currency,code])=>({moneda:currency,fecha:currency==='UTM'?`${payload?.[code]?.mes}-01`:payload?.[code]?.fecha,valor:Number(payload?.[code]?.valor),fuente:'indicadores.cl'}))
    .filter(row=>validDate(row.fecha||'')&&row.fecha<=today&&Number.isFinite(row.valor)&&row.valor>0&&row.valor<10000000);
}
export function alternativeSeries(payload,currency,today=day()){
  if(payload?.indicador!==codes[currency]||!Array.isArray(payload.serie))return [];
  return normalizeSeries({codigo:codes[currency],serie:payload.serie.map(row=>({...row,fecha:currency==='UTM'?`${row.mes}-01`:row.fecha}))},currency,today)
    .map(row=>({...row,fuente:'indicadores.cl'}));
}
export function usableQuote(rows,currency,date=day()){
  return rows.filter(row=>row.moneda===currency&&row.fecha<=date&&(currency==='UTM'?row.fecha.slice(0,7)===date.slice(0,7):(Date.parse(date)-Date.parse(row.fecha))/86400000<=7))
    .sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
}
