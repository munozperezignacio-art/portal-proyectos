import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rentalCurrency} from './rentalCurrency.js';
test('UF keeps original decimal tariff and supplies CLP to existing cost consumers',()=>{
  const r=rentalCurrency({costo:'0,77',moneda_costo:'UF',cambio_costo_clp:40000});
  assert.equal(r.costo_original,0.77);
  assert.equal(r.costo,30800);
  assert.equal(r.costo*180,5544000);
});
test('legacy CLP is unchanged; editing original UF does not convert twice',()=>{
  assert.equal(rentalCurrency({costo:250000}).costo,250000);
  const r=rentalCurrency({costo:0.77,moneda_costo:'UF',cambio_costo_clp:40000});
  assert.equal(rentalCurrency({...r,costo:r.costo_original}).costo,r.costo);
});
test('missing conversion, negative tariff and invalid values are rejected',()=>{
  for(const data of [{costo:0.77,moneda_costo:'UF'}, {costo:-1},{costo:'NaN'}, {costo:1,moneda_costo:'UF',cambio_costo_clp:0}])assert.throws(()=>rentalCurrency(data));
});
