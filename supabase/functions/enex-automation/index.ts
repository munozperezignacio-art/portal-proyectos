import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.6';
import {enexMailContent} from '../enviar-correo-sistema/enex-mail.js';
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return reply({error:'POST required'},405);
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const {data:authorized,error:authError}=await db.rpc('verify_internal_cron_secret',{p_secret:req.headers.get('x-cron-secret')||''});
 if(authError||authorized!==true)return reply({error:'Unauthorized'},401);
 const key=Deno.env.get('RESEND_API_KEY');
 if(!key)return reply({error:'Mail not configured'},503);
 try{
  const body=await req.json();
  if(body.action==='health')return reply({configured:true,company:'EMINSG',recipient:'imunozp@eminsg.cl'});
  const {data:run,error}=await db.rpc('enex_import_server',{p_run:body.run_id,p_rows:body.rows,p_evidence:body.evidence});
  if(error)return reply({error:'Import rejected; inspect data before retrying'},409);
  if(run.status!=='imported')return reply({run_id:run.id,status:run.status,inserted:run.new_ids.length,repeated:run.repeated,provider_id:run.provider_id});
  const {data:rows,error:readError}=await db.from('enex_movements').select('*,enex_assignments(movement_id)').eq('empresa','EMINSG').in('id',run.new_ids);
  if(readError||rows?.length!==run.new_ids.length)return reply({run_id:run.id,error:'Persistence verification failed; no mail sent'},500);
  const content=enexMailContent('EMINSG',run.new_ids,rows);
  // Atomic claim BEFORE contacting provider. Never retry a sending/uncertain run.
  const {data:claimed,error:claimError}=await db.from('enex_automation_runs').update({status:'sending'}).eq('id',run.id).eq('status','imported').select('id');
  if(claimError||claimed?.length!==1)return reply({run_id:run.id,status:'not_claimed'},409);
  let status='uncertain',provider_id=null;
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`enex-automation-${run.id}`},body:JSON.stringify({from:'Obraxis <notificaciones@obraxis.cl>',to:['imunozp@eminsg.cl'],subject:content.subject,html:content.html,text:content.text}),signal:AbortSignal.timeout(20000)});
   const result=await response.json();
   if(response.ok&&typeof result.id==='string'){status='accepted';provider_id=result.id;}
   else if(response.status>=400&&response.status<500)status='failed';
  }catch{/* uncertain: explicit audit, no automatic resend */}
  const {error:saveError}=await db.from('enex_automation_runs').update({status,provider_id,completed_at:new Date().toISOString(),error:status==='accepted'?null:'Provider did not confirm acceptance; do not retry automatically'}).eq('id',run.id).eq('status','sending');
  return reply({run_id:run.id,inserted:run.new_ids.length,repeated:run.repeated,status:saveError?'uncertain':status,provider_id,delivery_confirmed:false,card_rules_evaluated:false},saveError||status!=='accepted'?502:200);
 }catch{return reply({error:'Request not completed. Inspect run before retrying.'},500);}
});
