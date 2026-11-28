const test=require('node:test'),assert=require('node:assert/strict');
test('Topology matches UUID independent of execution order and preserves quality controls',async()=>{
 const {topographyPayload,configuredPileParts}=await import('../src/lib/topographyJournal.mjs');
 const elements=[{id:'uuid-A',partida_id:1,numero:'1',etapa:'A',revision_topografia:3,topografia:{tipo_control:'BST',deformacion:.2,observaciones:'Conservar'}},{id:'uuid-B',partida_id:1,numero:'1',etapa:'B',revision_topografia:0,topografia:{}}];
 const payloads=[...elements].reverse().map(e=>topographyPayload(e,{cota_inicial:'99,48',cota_final:'80'},'2026-11-28'));
 assert.deepEqual(payloads.map(p=>p.element_id),['uuid-B','uuid-A']);
 assert.equal(payloads[1].datos.tipo_control,'BST');assert.equal(payloads[1].datos.observaciones,'Conservar');assert.equal(payloads[1].revision,3);
 assert.equal(topographyPayload({...elements[0],revision_topografia:4},{cota_inicial:100,cota_final:90,baseRevision:3},'2026-11-28').revision,3,'Never silently adopt a concurrent revision');
 assert.equal(payloads[0].datos.cota_inicial,'99.48');assert.equal(payloads[0].datos.fecha_medicion,'2026-11-28');
 assert.throws(()=>topographyPayload(elements[0],{cota_inicial:'',cota_final:0},'2026-11-28'),/Completa/);
 assert.throws(()=>topographyPayload(elements[0],{cota_inicial:'NaN',cota_final:0},'2026-11-28'),/numérico/);
 assert.equal(topographyPayload(elements[0],{cota_inicial:0,cota_final:-5},'2026-11-28').datos.cota_inicial,'0');
 assert.deepEqual(configuredPileParts([],[{id:1}]),[]);assert.deepEqual(configuredPileParts([{partida_id:2}],[{id:1}]),[]);
 assert.equal(configuredPileParts([{partida_id:1}],[{id:1}]).length,1);
});
