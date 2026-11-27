import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSpecialtyProtocolPdf,projectControlElevation} from '../src/utils/specialtyProtocolPdf.js';
const backgrounds=Object.fromEntries(await Promise.all(['ejecucion','topografia'].map(async kind=>[kind,await Promise.all([1,2].map(n=>readFile(new URL(`../src/assets/protocols/${kind}-${n}.png`,import.meta.url))))])));
function fixture(tipo,count,controls=false){return {tipo,estado:'borrador',correlativo:'TEST',fecha:'2026-11-06',snapshot:{empresa:'Prueba',obra:'Prueba',autor:'Prueba',fijos:{},pilas:Array.from({length:count},(_,i)=>({id:String(i),numero:`PILA-${i+1}`,norte:100+i,este:200+i,topografia:{cota_inicial:10,cota_final:4,...(controls?{deformacion:0.2,profundidad_control:1}:{})},ejecucion:{longitud:6,paladas:12,volumen:3.24}}))}};}
test('execution retains original landscape pages and includes every pile across sheets',()=>{
 const doc=createSpecialtyProtocolPdf(fixture('ejecucion',81),null,backgrounds.ejecucion);
 assert.equal(doc.getNumberOfPages(),6);
 assert.ok(Math.abs(doc.internal.pageSize.getWidth()-841.92)<0.1);
 const text=doc.output();
 for(let i=1;i<=81;i++)assert.ok(text.includes(`PILA-${i})`),`Missing pile ${i}`);
});
test('quality controls beyond six get another original-format sheet rather than being dropped',()=>{
 const doc=createSpecialtyProtocolPdf(fixture('ejecucion',7,true),null,backgrounds.ejecucion);
 assert.equal(doc.getNumberOfPages(),4);
 assert.ok(doc.output().includes('PILA-7)'));
});
test('topography retains portrait layout and paginates after thirty piles',()=>{
 const doc=createSpecialtyProtocolPdf(fixture('topografia',31),null,backgrounds.topografia);
 assert.equal(doc.getNumberOfPages(),4);
 assert.ok(Math.abs(doc.internal.pageSize.getWidth()-595.32)<0.1);
 assert.ok(doc.output().includes('PILA-31)'));
});
test('missing template and oversized fields fail explicitly instead of silently clipping',()=>{
 assert.throws(()=>createSpecialtyProtocolPdf(fixture('ejecucion',1),null,[]),/plantilla/);
 const p=fixture('ejecucion',1);p.snapshot.obra='Texto demasiado largo '.repeat(100);
 assert.throws(()=>createSpecialtyProtocolPdf(p,null,backgrounds.ejecucion),/no cabe/);
});
test('new project control uses platform while old snapshots keep design elevation',()=>{
 assert.equal(projectControlElevation({usar_cota_plataforma:true,plataforma_proyecto:'99.48'},{cota_diseno:'80'}),'99.48');
 assert.equal(projectControlElevation({plataforma_proyecto:'99.48'},{cota_diseno:'80'}),'80');
 assert.equal(projectControlElevation({usar_cota_plataforma:true},{cota_diseno:'80'}),'');
});
test('BST type, depth and pile comments survive PDF export',()=>{
 const p=fixture('ejecucion',1,true);
 p.snapshot.fijos={usar_cota_plataforma:true,plataforma_proyecto:'99.48'};
 Object.assign(p.snapshot.pilas[0].topografia,{tipo_control:'BST',observaciones:'Comentario exclusivo pila 1',profundidad_control:1.5});
 const doc=createSpecialtyProtocolPdf(p,null,backgrounds.ejecucion);
 assert.equal(doc.getNumberOfPages(),3);
 assert.ok(doc.output().includes('BST: 0,20'));
 assert.ok(doc.output().includes('1,50'));
 assert.ok(doc.output().includes('Comentario exclusivo pila 1'));
 doc.save('C:/Users/ignac/AppData/Local/Temp/protocol-controls-test.pdf');
 const topo=fixture('topografia',1);
 topo.snapshot.fijos={usar_cota_plataforma:true,plataforma_proyecto:'99.48',puntos_referencia:[{referencia:'PR-1',norte:100,este:200,elevacion:99.48}],autocontrol:{pilas_grava:'si'}};
 topo.snapshot.pilas[0].topografia={cota_diseno:80,cota_real:99.5};
 const topodoc=createSpecialtyProtocolPdf(topo,null,backgrounds.topografia);
 assert.ok(topodoc.output().includes('99,480'));
 assert.ok(topodoc.output().includes('0,020'));
 topodoc.save('C:/Users/ignac/AppData/Local/Temp/protocol-topography-test.pdf');
});
