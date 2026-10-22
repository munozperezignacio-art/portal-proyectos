import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CSV_HEADER,parseEnexCsv,validateMovement,movementKey,planImport,summarize,summaryText,createOperationGate} from '../src/utils/enex.js';
import {readEnex,importEnex,sendEnexSummary} from '../src/services/enexService.js';
const row={portal:'transporte',document:'123',occurred_local:'2026-01-02 03:04:05',vehicle:'TEST01',kind:'Carga',liters_milli:12345,amount_signed:-18000};
const csv=CSV_HEADER+'\ntransporte,2026-01-02 03:04:05,TEST01,123,12.345,-18000';
test('CSV fixture and exact integer units',()=>assert.deepEqual(parseEnexCsv(csv),[row]));
test('CSV BOM and CRLF',()=>assert.deepEqual(parseEnexCsv('\ufeff'+csv.replaceAll('\n','\r\n')+'\r\n'),[row]));
test('reimport idempotent',()=>assert.deepEqual(planImport('FICTICIA',[row,row],[row]),{added:[],repeated:2}));
test('conflict fails without overwriting',()=>assert.throws(()=>planImport('FICTICIA',[{...row,amount_signed:-1}],[row]),/Conflicto/));
test('portal identity isolated',()=>assert.equal(planImport('FICTICIA',[row,{...row,portal:'empresa'}]).added.length,2));
test('company and delimiter safe key',()=>{assert.notEqual(movementKey('A|B',row),movementKey('A',row));assert.notEqual(movementKey('A',row),movementKey('B',row));});
for(const patch of [{liters_milli:0},{liters_milli:NaN},{liters_milli:Infinity},{liters_milli:1.1},{amount_signed:0},{amount_signed:1},{amount_signed:NaN},{kind:'Abono'},{kind:'Anulación'},{document:''},{portal:'other'},{occurred_local:'2026-02-30 00:00:00'},{occurred_local:'2026-01-02T03:04:05Z'},{vehicle:' TEST'}]) {
 test('reject invalid '+JSON.stringify(patch),()=>assert.throws(()=>validateMovement({...row,...patch})));
}
test('reject extra columns and formulas',()=>{assert.throws(()=>parseEnexCsv(csv+',extra'));assert.throws(()=>parseEnexCsv(csv.replace('12.345','=1+1')));});
test('summary retains signs, pending, no alleged alerts',()=>{assert.deepEqual(summarize([row]),{count:1,liters_milli:12345,amount_signed:-18000,pending:1});const s=summaryText('FICTICIA',[row],'TEST');assert.match(s,/no evaluadas/);assert.match(s,/no corresponde a costo neto/);});
test('ordering does not change totals',()=>assert.deepEqual(summarize([row,{...row,document:'124'}]),summarize([{...row,document:'124'},row])));
function mockDb(records,fail=false){let calls=[];return {calls,from(){return {select(){return this;},eq(k,v){calls.push([k,v]);return this;},order(){return this;},async range(lo,hi){return {data:records.slice(lo,hi+1),error:fail?{}:null};}};},async rpc(name,args){calls.push([name,args]);return {data:{inserted:1,repeated:0,received:1}};}};}
const stored={...row,id:'synthetic',empresa:'FICTICIA',enex_assignments:[]};
test('pagination reads beyond server page',async()=>{const db=mockDb(Array.from({length:501},(_,i)=>({...stored,id:String(i)})));assert.equal((await readEnex(db,'FICTICIA')).length,501);assert.equal(db.calls.length,2);});
test('tenant mismatch fails closed',async()=>assert.rejects(readEnex(mockDb([stored]),'OTHER'),/Empresa/));
test('read errors never become empty successful totals',async()=>assert.rejects(readEnex(mockDb([],true),'FICTICIA')));
test('import verifies persisted rows independently',async()=>{const db=mockDb([stored]);assert.equal((await importEnex(db,'FICTICIA',[row])).stored.length,1);});
test('successful RPC without persistence is failure',async()=>assert.rejects(importEnex(mockDb([]),'FICTICIA',[row]),/Persistencia/));
test('no real rows in test; SQL draft has tenant policies and transaction',()=>{const sql=readFileSync(new URL('../../supabase/sql-drafts/enex.sql',import.meta.url),'utf8');assert.match(sql,/security invoker/g);assert.doesNotMatch(sql,/security definer/i);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/unique\(empresa,portal,document\)/);assert.match(sql,/Work\/company mismatch/);assert.doesNotMatch(sql,/insert into public\.(costos_reales_obra|maquinaria_uso_diario)/);});

test('same document changed date or vehicle requires review',()=>{for(const patch of [{vehicle:'OTHER'},{occurred_local:'2026-01-03 03:04:05'}])assert.throws(()=>planImport('FICTICIA',[{...row,...patch}],[row]),/Conflicto/);});

test('existing foreign company is rejected by plan',()=>assert.throws(()=>planImport('A',[row],[{...row,empresa:'B'}]),/Empresa/));
test('existing contradictory records fail',()=>assert.throws(()=>planImport('A',[row],[row,{...row,amount_signed:-2}]),/Conflicto/));

test('synchronous operation guard rejects double click and releases',()=>{const gate=createOperationGate();assert.equal(gate.enter(),true);assert.equal(gate.enter(),false);gate.leave();assert.equal(gate.enter(),true);});
test('assignment audit executes after actual write',()=>{const sql=readFileSync(new URL('../../supabase/sql-drafts/enex.sql',import.meta.url),'utf8');assert.match(sql,/create trigger enex_assignment_audit after insert or update/);assert.match(sql,/then return null;end if;/);});

test('mail adapter sends only persisted identifiers and own recipient',async()=>{let call;const db={functions:{invoke:async(name,args)=>{call={name,args};return {data:{success:true,id:'fake'}};}}};assert.equal(await sendEnexSummary(db,'FICTICIA','person@example.test',[stored]),'fake');assert.equal(call.args.body.permissionKey,'maquinaria.enex.enviar');assert.deepEqual(call.args.body.enexMovementIds,['synthetic']);assert.equal(call.args.body.htmlContent,undefined);});
test('uncertain mail result is one attempt, never auto-retried',async()=>{let count=0;const db={functions:{invoke:async()=>{count++;return {error:{}};}}};await assert.rejects(sendEnexSummary(db,'FICTICIA','person@example.test',[stored]),/No repetir/);assert.equal(count,1);});

test('metadata columns are not writable by authenticated callers',()=>{const sql=readFileSync(new URL('../../supabase/sql-drafts/enex.sql',import.meta.url),'utf8');for(const line of sql.split('\n').filter(l=>l.startsWith('grant insert(')))assert.doesNotMatch(line,/\b(actor|ingested_at|created_at|updated_at|happened_at)\b/);});
