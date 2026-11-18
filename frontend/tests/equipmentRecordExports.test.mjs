import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
import JSZip from 'jszip';
import QRCode from 'qrcode';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {equipmentRecordPdf,buildEquipmentRecordDownload,readEquipmentRecords}=await server.ssrLoadModule('/src/utils/equipmentRecordExports.js');
 const equipment={id:1,empresa:'TEST',tipo:'EXCAVADORA',patente:'TEST-01',marca:'Modelo prueba'};
 const form={id:1,empresa:'TEST',titulo:'CHECKLIST DE EXCAVADORA',campos:[{id:'state',label:'Estado del equipo',type:'radio',options:['Bueno','Malo']},{id:'images',label:'Evidencias',type:'attachments',includeInPdf:true}]};
 const image=await QRCode.toDataURL('EVIDENCIA LOCAL DE PRUEBA');
 const usage={id:1,empresa:'TEST',equipo_id:'1',equipo_tipo:equipment.tipo,equipo_patente:equipment.patente,obra_nombre:'Obra A',fecha:'2026-11-17',horometro_inicial:100,horometro_final:101,horas_trabajadas:1,operador:'Persona de prueba',observaciones:'Reporte de prueba local',reporte_datos:{codigo:'MAQ-01',revision:'01',hubo_falla:false}};
 const checklist={id:2,formulario_id:1,prevencion_formularios:form,proyecto_nombre:'Obra A',inspector:'Persona de prueba',created_at:'2026-11-17',respuestas:{state:'Bueno',images:[{name:'Evidencia.png',data:image,type:'image/png'}],_qr_identidad:{equipo_id:1,fecha:'2026-11-17'},_qr_formulario:form}};
 const maintenance={id:3,empresa:'TEST',equipo_id:1,obra_nombre:'Obra A',fecha:'2026-11-17',tipo:'Preventiva',descripcion:'Cambio de filtros y revisión general. '.repeat(20),horometro:101,responsable:'Persona de prueba'};
 const tables={maquinaria_uso_diario:[usage],maquinaria_mantenciones:[maintenance],maquinaria_fallas:[],inventario_maquinaria:[equipment],obras:[{id:1,nombre:'Obra A',empresa:'TEST'}],maquinaria_reporte_config:[{empresa:'TEST',codigo:'MAQ-01',revision:'01'}],prevencion_respuestas:[checklist]};
 const db={from(table){const filters=[];let single=false,start=0,end=999;const q={select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},range(a,b){start=a;end=b;return q;},maybeSingle(){single=true;return q;},then(resolve){const rows=(tables[table]||[]).filter(row=>filters.every(([k,v])=>String(k==='prevencion_formularios.empresa'?row.prevencion_formularios.empresa:k.startsWith('respuestas->')?row.respuestas._qr_identidad.equipo_id:row[k])===String(v))).slice(start,end+1);resolve({data:single?rows[0]||null:rows,error:null});}};return q;}};
 const options={company:'TEST',equipment,workName:'Obra A'};
 const records=await readEquipmentRecords(db,{...options,equipmentId:1,canReadChecklists:true});assert.equal(records.length,3);
 assert.equal((await readEquipmentRecords(db,{...options,equipmentId:1,workName:'Obra B',canReadChecklists:true})).length,0);
 assert.equal((await readEquipmentRecords(db,{...options,equipmentId:1,canReadChecklists:false})).length,2);
 const output=new URL('./artifacts/equipment-records/',import.meta.url);mkdirSync(output,{recursive:true});
 const render=async record=>{const bytes=await equipmentRecordPdf(db,record,options);assert.equal(new TextDecoder().decode(bytes.slice(0,4)),'%PDF');writeFileSync(new URL(record.kind+'.pdf',output),bytes);return bytes;};
 const zip=await buildEquipmentRecordDownload(records,options,render);assert.ok(zip.name.endsWith('.zip'));
 const archive=await JSZip.loadAsync(await zip.blob.arrayBuffer());assert.equal(Object.keys(archive.files).length,3);
 writeFileSync(new URL('registros.zip',output),Buffer.from(await zip.blob.arrayBuffer()));
 const one=await buildEquipmentRecordDownload([records[0]],options,render);assert.equal(one.blob.type,'application/pdf');
 await assert.rejects(buildEquipmentRecordDownload(records,options,async()=>{throw Error('No autorizado');}),/No autorizado/);
 console.log('PASS: scope, checklist permissions, 3 individual PDFs, single PDF, ZIP and all-or-nothing errors');
}finally{await server.close();}
