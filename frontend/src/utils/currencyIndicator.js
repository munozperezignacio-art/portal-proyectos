export function chileanDate(now=new Date()) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function indicatorQuote(data,currency,today=chileanDate()) {
  const code={UF:'uf',USD:'dolar'}[currency];
  if(!code || data?.codigo!==code || !Array.isArray(data.serie))throw Error('Respuesta de indicador inválida.');
  const quotes=data.serie.map(row=>({value:Number(row.valor),date:String(row.fecha||'').slice(0,10)}))
    .filter(row=>Number.isFinite(row.value)&&row.value>0&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&row.date<=today)
    .sort((a,b)=>b.date.localeCompare(a.date));
  if(!quotes.length)throw Error('No hay un valor publicado para la fecha actual.');
  // No presentar silenciosamente un indicador antiguo como si fuera actual.
  if((Date.parse(today)-Date.parse(quotes[0].date))/86400000>7)throw Error('El último indicador publicado está desactualizado.');
  return {...quotes[0],source:'mindicador.cl'};
}
export async function fetchCurrencyIndicator(currency,{signal,fetcher=fetch,today=chileanDate()}={}) {
  const code={UF:'uf',USD:'dolar'}[currency];
  if(!code)throw Error('Moneda no soportada.');
  const response=await fetcher(`https://mindicador.cl/api/${code}`,{signal});
  if(!response.ok)throw Error('El servicio de indicadores no respondió correctamente.');
  return indicatorQuote(await response.json(),currency,today);
}
