import test from 'node:test';
import assert from 'node:assert/strict';
import {chileanDate,indicatorQuote,fetchCurrencyIndicator} from './currencyIndicator.js';
test('indicator uses the newest valid value not later than today, not array position or published future UF',()=>{
  const data={codigo:'uf',serie:[{fecha:'2026-10-21T03:00:00Z',valor:99999},{fecha:'2026-10-16T03:00:00Z',valor:40000},{fecha:'2026-10-19T03:00:00Z',valor:40234.56},{fecha:'2026-10-20',valor:0}]};
  assert.deepEqual(indicatorQuote(data,'UF','2026-10-19'),{value:40234.56,date:'2026-10-19',source:'mindicador.cl'});
  assert.equal(indicatorQuote({codigo:'dolar',serie:[{fecha:'2026-10-16',valor:950.25}]},'USD','2026-10-18').date,'2026-10-16');
});
test('invalid, empty, negative, non-finite, stale and wrong-currency responses never become exchange rates',()=>{
  for(const data of [null,{}, {codigo:'uf',serie:[]},{codigo:'dolar',serie:[{fecha:'2026-10-19',valor:900}]},
    {codigo:'uf',serie:[{fecha:'2026-10-19',valor:-1}]},{codigo:'uf',serie:[{fecha:'2026-10-19',valor:'Infinity'}]},
    {codigo:'uf',serie:[{fecha:'2026-09-01',valor:40000}]},{codigo:'uf',serie:[{fecha:'2026-10-20',valor:40000}]}])assert.throws(()=>indicatorQuote(data,'UF','2026-10-19'));
});
test('Chile day is not UTC day near midnight',()=>assert.equal(chileanDate(new Date('2026-10-19T01:00:00Z')),'2026-10-18'));
test('request maps USD to observed dollar, propagates cancellation and reports HTTP errors',async()=>{
  const controller=new AbortController();let requested;
  const quote=await fetchCurrencyIndicator('USD',{today:'2026-10-19',signal:controller.signal,fetcher:async(url,options)=>{
    requested=url;assert.equal(options.signal,controller.signal);return {ok:true,json:async()=>({codigo:'dolar',serie:[{fecha:'2026-10-19',valor:950}]})};
  }});
  assert.equal(requested,'https://mindicador.cl/api/dolar');assert.equal(quote.value,950);
  await assert.rejects(fetchCurrencyIndicator('UF',{fetcher:async()=>({ok:false})}),/servicio/);
});
