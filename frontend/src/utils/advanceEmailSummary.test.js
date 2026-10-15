import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdvanceEmailSummary, renderAdvanceSummaryHtml, advanceCurveAttachment } from './advanceEmailSummary.js';
const parts=[{id:1,partida:'Pilotes',unidad:'UND',quantity:100,unitPrice:10,start:'2026-10-01',duration:20},{id:2,partida:'Excavación',unidad:'m³',quantity:100,unitPrice:10,start:'2026-10-01',duration:20}];
const businessDays=()=>10;
const reports=[{id:1,partida_id:1,partida:'Pilotes',cantidad:20,created_at:'2026-10-10T12:00:00Z'},{id:2,partida_id:2,partida:'Excavación',cantidad:10,created_at:'2026-10-13T12:00:00Z'},{id:3,partida_id:1,partida:'Pilotes',cantidad:70,created_at:'2026-10-15T12:00:00Z'}];
test('email real and plan share report cutoff, not current date or later reports',()=>{
 const s=buildAdvanceEmailSummary({parts,reports,cutoff:'2026-10-13',start:'2026-10-01',businessDays});
 assert.equal(s.latest.dateStr,'2026-10-13');assert.equal(s.latest.real,300);assert.equal(s.latest.realPct,15);assert.equal(s.latest.plannedPct,50);assert.equal(s.gap,-35);assert.equal(s.recent.at(-1).dateStr,'2026-10-13');assert.equal(s.recent.length,5);
});
test('fresh edited report contributes once; absent days are explicit and units stay separate',()=>{
 const edited=reports.filter(r=>r.id!==2).concat({...reports[1],cantidad:15});
 const s=buildAdvanceEmailSummary({parts,reports:edited,cutoff:'2026-10-13',businessDays});
 assert.equal(s.latest.real,350);const html=renderAdvanceSummaryHtml(s,true);
 assert.ok(html.includes('UND'));assert.ok(html.includes('m³'));assert.ok(html.includes('Sin producción reportada'));assert.ok(html.includes('cid:obraxis-curva-s'));assert.ok(!html.includes('2026-10-15'));
});
test('unpriced work displays N/D, does not invent progress or attach a blank curve',()=>{
 const s=buildAdvanceEmailSummary({parts:parts.map(p=>({...p,unitPrice:0})),reports,cutoff:'2026-10-13',businessDays});
 assert.equal(s.latest.realPct,null);assert.equal(advanceCurveAttachment(s),null);assert.ok(renderAdvanceSummaryHtml(s,false).includes('N/D'));
});
test('escapes untrusted names in email HTML',()=>{
 const p={...parts[0],partida:'<img src=x onerror=alert(1)>'};
 const s=buildAdvanceEmailSummary({parts:[p],reports:[{partida_id:1,cantidad:1,created_at:'2026-10-13'}],cutoff:'2026-10-13',businessDays});
 const html=renderAdvanceSummaryHtml(s,false);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
});
test('PNG attachment has matching CID without external image hosting',()=>{
 const summary=buildAdvanceEmailSummary({parts,reports,cutoff:'2026-10-13',businessDays});
 const ctx=new Proxy({}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)});
 const doc={createElement:()=>({getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,dGVzdA=='})};
 const a=advanceCurveAttachment(summary,doc);assert.equal(a.content_id,'obraxis-curva-s');assert.equal(a.content,'dGVzdA==');assert.equal(a.content_type,'image/png');
});
