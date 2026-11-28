// Read-only check of the assets actually served by production.
import assert from 'node:assert/strict';
const base='https://www.obraxis.cl';
const response=await fetch(base);
assert.equal(response.status,200);
const html=await response.text();
const paths=[...html.matchAll(/src="([^"]+\.js)"/g)].map(m=>m[1]);
assert.ok(paths.length,'Production entry bundle');
let code='';
for(const path of paths){
 const r=await fetch(new URL(path,base));assert.equal(r.status,200);code+=await r.text();
}
const chunks=[...new Set([...code.matchAll(/(?:assets\/)?(?:CalidadObras|QualitySpecialties|SpecialtyProtocols|ProtocolReviewAction|SpecialtyReports)-[a-zA-Z0-9_-]+\.js/g)].map(m=>m[0]))];
for(const chunk of chunks){const r=await fetch(new URL('/'+(chunk.startsWith('assets/')?chunk:'assets/'+chunk),base));assert.equal(r.status,200);code+=await r.text();}
assert.ok(code.includes('protocol_review_api'),'Production review action');
assert.ok(code.includes('revision_revisada'),'Production revision approval gate');
assert.ok(code.includes('Marcar como revisado'),'Production review button');
console.log('PASS production: HTTP 200, review action and reviewed-revision gate served by Obraxis');
