import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
test('document expiry and recoverable deletion preserve document identity and prevent public deletion',async()=>{
 const db=new PGlite();try{
 await db.exec("create table equipo_documentos_qr(id int primary key,nombre text,publico_qr boolean);insert into equipo_documentos_qr values(1,'Original',true)");
 await db.exec(readFileSync(new URL('../../supabase/migrations/20261117222629_equipment_document_metadata.sql',import.meta.url),'utf8'));
 await db.exec("update equipo_documentos_qr set nombre='Manual',fecha_vencimiento='2027-03-01'");
 await assert.rejects(db.exec("update equipo_documentos_qr set deleted_at=now()"),/equipo_documento_deleted_private/);
 await db.exec("update equipo_documentos_qr set publico_qr=false,deleted_at=now()");
 assert.equal((await db.query('select count(*)::int n from equipo_documentos_qr')).rows[0].n,1);
 await assert.rejects(db.exec("update equipo_documentos_qr set publico_qr=true"),/equipo_documento_deleted_private/);
 await db.exec("update equipo_documentos_qr set deleted_at=null");
 const row=(await db.query('select * from equipo_documentos_qr')).rows[0];assert.equal(row.nombre,'Manual');assert.equal(row.publico_qr,false);assert.ok(row.fecha_vencimiento);
 }finally{await db.close();}
});

