import test from 'node:test';import assert from 'node:assert/strict';
import {createIndicatorCache} from './economicIndicatorsCache.js';
import {normalizeSeries,alternativeQuotes,alternativeSeries,usableQuote} from '../../../supabase/functions/indicadores-economicos/quotes.js';
const rows=[{moneda:'UF',fecha:'2026-10-19',valor:41183.94,fuente:'indicadores.cl'},{moneda:'USD',fecha:'2026-10-16',valor:980,fuente:'mindicador.cl'},{moneda:'UTM',fecha:'2026-10-01',valor:72151,fuente:'indicadores.cl'}];
const options={date:'2026-10-19'};
test('one prefetched DB read serves different modules and currencies without upstream requests',async()=>{
  let reads=0;let refresh=0;
  const cache=createIndicatorCache({read:async()=>{reads++;return rows;},refresh:async()=>{refresh++;return [];}});
  await cache.prefetch(options.date);
  const [uf,usd,utm]=await Promise.all(['UF','USD','UTM'].map(c=>cache.load(c,options)));
  assert.equal(uf.value,41183.94);assert.equal(usd.date,'2026-10-16');assert.equal(utm.value,72151);
  assert.equal(reads,1);assert.equal(refresh,0);
});
test('stored verified quotes are immediately reusable offline and survive recreation of the service',async()=>{
  const data=new Map();const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  createIndicatorCache({storage}).remember(rows);
  const cache=createIndicatorCache({storage,read:async()=>{throw Error('offline');},refresh:async()=>{throw Error('must not refresh');}});
  assert.equal(cache.peek('UF',options.date).value,41183.94);assert.equal((await cache.load('UF',options)).value,41183.94);
  assert.equal(cache.peek('UF','2026-10-18'),null); // nunca aplicar UF posterior al corte
});
test('missing currencies share one server refresh; no fabricated manual or stale quote enters the cache',async()=>{
  let calls=0;const cache=createIndicatorCache({read:async()=>[],refresh:async()=>{calls++;return rows;}});
  await Promise.all(['UF','USD'].map(c=>cache.load(c,options)));assert.equal(calls,1);
  cache.remember([{moneda:'UF',fecha:'2026-10-20',valor:999,fuente:'manual'},{moneda:'UF',fecha:'2026-10-19',valor:-1,fuente:'indicadores.cl'}]);
  assert.equal(cache.peek('UF','2026-11-19'),null);assert.equal(cache.peek('UTM','2026-11-01'),null);
  assert.equal(cache.peek('UF',options.date).value,41183.94);
});
test('cache errors allow retry without clearing verified previous dates; old RRHH defaults are not imported as current',async()=>{
  let fail=true;const cache=createIndicatorCache({read:async()=>{throw Error('connection');},refresh:async()=>{if(fail)throw Error('offline');return rows;},storage:{getItem:()=>'{"uf":38480,"ultimaActualizacion":"hoy"}'}});
  await assert.rejects(cache.load('UF',options));fail=false;assert.equal((await cache.load('UF',options)).date,options.date);
});
test('provider parser accepts future published UF for storage but only selects quotes valid at cutoff',()=>{
  const series=normalizeSeries({codigo:'uf',serie:[{fecha:'2026-10-19',valor:41183.94},{fecha:'2026-10-20',valor:41200},{fecha:'2026-02-30',valor:10}]},'UF','2026-10-19');
  assert.equal(series.length,2);assert.equal(usableQuote(series,'UF','2026-10-19').valor,41183.94);
  assert.equal(normalizeSeries({codigo:'dolar',serie:[{fecha:'2026-10-19',valor:900}]},'UF').length,0);
  assert.deepEqual(alternativeQuotes({uf:{fecha:'2026-10-19',valor:41183.94},utm:{mes:'2026-10',valor:72151}},'2026-10-19').map(x=>x.moneda),['UF','UTM']);
  const history=alternativeSeries({indicador:'uf',serie:[{fecha:'2026-10-13',valor:41150},{fecha:'2026-10-19',valor:41183.94}]},'UF','2026-10-19');
  assert.equal(usableQuote(history,'UF','2026-10-13').valor,41150);
  assert.equal(usableQuote(history,'UF','2026-10-13').fuente,'indicadores.cl');
});
