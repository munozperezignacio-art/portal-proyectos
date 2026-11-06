import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleClosing } from './scheduleClosing.js';
import { marginIndicators } from './budgetMargin.js';
const completion = { obra_id:84, estado:'completada', fecha_termino:'2026-10-30' };
const args = { workId:84, completion, plannedAt:date=>date <= '2026-10-30'?80:100, earnedAt:date=>date < '2026-10-30'?50:100 };
test('SPI stays at closing date while later costs change CPI',()=>{
 const closing = scheduleClosing({...args,cutoff:'2026-10-30'});
 const later = scheduleClosing({...args,cutoff:'2026-11-06'});
 assert.deepEqual(later,closing);
 assert.equal(later.spi,1.25);
 const before=marginIndicators({margin:20,sale:100,earnedSale:100,actualCost:60});
 const after=marginIndicators({margin:20,sale:100,earnedSale:100,actualCost:90});
 assert.ok(before.cpi>1 && after.cpi<1);
});
test('historical cuts before completion do not use future closing',()=>{
 const r=scheduleClosing({...args,cutoff:'2026-10-29'});
 assert.equal(r.closed,false);assert.equal(r.date,'2026-10-29');assert.equal(r.spi,0.625);
});
test('open works and completion belonging to another work do not freeze',()=>{
 for(const c of [null,{...completion,obra_id:85},{...completion,estado:'en_curso'},{...completion,fecha_termino:null}]) {
  const r=scheduleClosing({...args,completion:c,cutoff:'2026-11-06'});
  assert.equal(r.closed,false);assert.equal(r.date,'2026-11-06');
 }
});
test('zero planned value does not invent SPI',()=>{
 assert.equal(scheduleClosing({...args,cutoff:'2026-11-06',plannedAt:()=>0}).spi,null);
});
