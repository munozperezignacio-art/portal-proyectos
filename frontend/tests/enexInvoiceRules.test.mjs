import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {parseMachineryThreshold,readInvoiceRules,saveInvoiceRules} from '../src/services/enexInvoiceRulesService.js';

test('Editable threshold accepts Chilean decimals without allowing silent rounding',()=>{
  assert.equal(parseMachineryThreshold('180'),180000);
  assert.equal(parseMachineryThreshold('180,001'),180001);
  assert.equal(parseMachineryThreshold('200.5'),200500);
  for(const value of ['','0','-1','180.0001','1e3','180 litros','100001','NaN'])assert.throws(()=>parseMachineryThreshold(value));
});
function mockDb(result){const calls=[];return {calls,from(table){calls.push(['table',table]);return{
  select(value){calls.push(['select',value]);return this;},eq(...value){calls.push(['eq',...value]);return this;},
  insert(value){calls.push(['insert',value]);return this;},update(value){calls.push(['update',value]);return this;},
  maybeSingle:async()=>result,
};}};}
test('Absent config gets default; read failures do not silently become defaults',async()=>{
  assert.equal((await readInvoiceRules(mockDb({data:null}),'TEST')).machinery_threshold_milli,180000);
  await assert.rejects(readInvoiceRules(mockDb({error:{}}),'TEST'));
  await assert.rejects(readInvoiceRules(mockDb({data:{empresa:'OTHER'}}),'TEST'));
});
test('Save uses revision comparison and uncertain reply cannot report success',async()=>{
  const db=mockDb({data:{empresa:'TEST',machinery_threshold_milli:200000,revision:3}});
  await saveInvoiceRules(db,'TEST',{empresa:'TEST',revision:2},200000);
  assert.ok(db.calls.some(c=>c[0]==='eq'&&c[1]==='revision'&&c[2]===2));
  await assert.rejects(saveInvoiceRules(mockDb({data:null}),'TEST',{empresa:'TEST',revision:2},200000),/Actualiza/);
});
test('Rules persist, audit actor, protect tenants/readers/anon and detect concurrent changes',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role authenticated;create role anon;create schema auth;create schema private;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function private.enex_allowed(company text, action text) returns boolean language sql stable as $$
        select auth.uid() is not null and company=current_setting('test.company',true)
        and (action='ver' or current_setting('test.edit',true)='true')$$;
      grant usage on schema private,auth to authenticated;grant execute on function auth.uid(),private.enex_allowed(text,text) to authenticated;`);
    await db.exec(await readFile(new URL('../../supabase/schema/enex-invoice-rules.sql',import.meta.url),'utf8'));
    const actor='00000000-0000-0000-0000-000000000001';
    async function asUser(sql,params=[],company='TEST',edit=true,role='authenticated'){
      return db.transaction(async tx=>{
        await tx.query("select set_config('test.uid',$1,true),set_config('test.company',$2,true),set_config('test.edit',$3,true)",[actor,company,String(edit)]);
        await tx.exec(`set local role ${role}`);return tx.query(sql,params);
      });
    }
    await asUser("insert into enex_invoice_rules(empresa,machinery_threshold_milli) values('TEST',180000)");
    await asUser("update enex_invoice_rules set machinery_threshold_milli=200000 where empresa='TEST' and revision=1");
    assert.equal((await asUser('select machinery_threshold_milli,revision,actor from enex_invoice_rules')).rows[0].revision,2);
    const audit=(await asUser('select * from enex_invoice_rules_audit order by revision')).rows;
    assert.equal(audit.length,2);assert.equal(audit[1].previous_threshold_milli,180000);assert.equal(audit[1].actor,actor);
    const concurrent=await asUser("update enex_invoice_rules set machinery_threshold_milli=250000 where empresa='TEST' and revision=1 returning *");
    assert.equal(concurrent.rows.length,0);
    assert.equal((await asUser('select * from enex_invoice_rules',[],'OTHER')).rows.length,0);
    assert.equal((await asUser('select * from enex_invoice_rules_audit',[],'OTHER')).rows.length,0);
    assert.equal((await asUser("update enex_invoice_rules set machinery_threshold_milli=1 returning *",[],'TEST',false)).rows.length,0);
    await assert.rejects(asUser("insert into enex_invoice_rules(empresa,machinery_threshold_milli) values('OTHER',180000)"));
    await assert.rejects(asUser("update enex_invoice_rules set machinery_threshold_milli=0"));
    await assert.rejects(asUser("update enex_invoice_rules set actor='00000000-0000-0000-0000-000000000002'"));
    await assert.rejects(asUser("update enex_invoice_rules set empresa='OTHER'"));
    await assert.rejects(asUser("insert into enex_invoice_rules_audit(empresa,revision,machinery_threshold_milli) values('TEST',99,1)"));
    await assert.rejects(asUser("delete from enex_invoice_rules"));
    await assert.rejects(asUser('select * from enex_invoice_rules',[],'TEST',true,'anon'));
    assert.equal((await asUser('select * from enex_invoice_rules_audit')).rows.length,2);
  }finally{await db.close();}
});
