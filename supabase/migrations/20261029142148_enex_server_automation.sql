-- Server-only import for the EMINSG automation explicitly authorized by its owner.
-- Does not change browser permissions, assignments, or existing movements.
begin;
create table public.enex_automation_runs (
 id uuid primary key,
 empresa text not null default 'EMINSG' check(empresa='EMINSG'),
 requested_at timestamptz not null default now(),
 evidence jsonb not null,
 payload jsonb not null,
 new_ids uuid[] not null default '{}',
 repeated integer not null default 0,
 status text not null check(status in ('imported','no_new','sending','accepted','uncertain','failed')),
 provider_id text,
 error text,
 completed_at timestamptz
);
alter table public.enex_automation_runs enable row level security;
revoke all on public.enex_automation_runs from public,anon,authenticated;
grant select,insert,update on public.enex_automation_runs to service_role;

create function public.enex_import_server(p_run uuid,p_rows jsonb,p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare item jsonb; existing public.enex_movements; previous public.enex_automation_runs;
 ids uuid[]:='{}'; new_id uuid; repeated_count integer:=0; owner_id uuid;
begin
 if current_user not in ('postgres','service_role') then raise exception 'Server only'; end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>1000
 or p_evidence->>'company' is distinct from 'EMIN SISTEMAS GEOTECNICOS S.A.'
 or p_evidence->>'all_pages_checked' is distinct from 'true'
 or coalesce(p_evidence->>'portal','') not in ('empresa','transporte')
 or coalesce(p_evidence->>'from','') !~ '^\d{4}-\d{2}-\d{2}$'
 or coalesce(p_evidence->>'through','') !~ '^\d{4}-\d{2}-\d{2}$'
 then raise exception 'Invalid verified read'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('enex:EMINSG',0));
 select * into previous from public.enex_automation_runs where id=p_run;
 if found then
  if previous.payload<>p_rows or previous.evidence<>p_evidence then raise exception 'Run payload conflict'; end if;
  return to_jsonb(previous)-'payload';
 end if;
 select auth_user_id into strict owner_id from public.usuarios where empresa='EMINSG' and lower(correo)='imunozp@eminsg.cl' and auth_user_id is not null;
 for item in select value from jsonb_array_elements(p_rows) loop
  if item->>'portal' is distinct from p_evidence->>'portal' or item->>'kind' is distinct from 'Carga'
   or coalesce(item->>'document','') !~ '^\d{1,30}$'
   or coalesce(item->>'occurred_local','') !~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'
   or (item->>'occurred_local')::date < (p_evidence->>'from')::date
   or (item->>'occurred_local')::date > (p_evidence->>'through')::date
   or jsonb_typeof(item->'liters_milli') is distinct from 'number'
   or jsonb_typeof(item->'amount_signed') is distinct from 'number'
   or coalesce(item->>'liters_milli','') !~ '^[0-9]+$'
   or coalesce(item->>'amount_signed','') !~ '^-[0-9]+$'
   or (item-'portal'-'document'-'occurred_local'-'vehicle'-'kind'-'liters_milli'-'amount_signed')<>'{}'::jsonb
  then raise exception 'Invalid movement'; end if;
  select * into existing from public.enex_movements where empresa='EMINSG' and portal=item->>'portal' and document=item->>'document';
  if found then
   if existing.occurred_local is distinct from (item->>'occurred_local')::timestamp
    or existing.vehicle is distinct from item->>'vehicle'
    or existing.liters_milli is distinct from (item->>'liters_milli')::bigint
    or existing.amount_signed is distinct from (item->>'amount_signed')::bigint
    or existing.kind is distinct from item->>'kind' then raise exception 'Conflicting movement; rolled back'; end if;
   repeated_count:=repeated_count+1;
  else
   insert into public.enex_movements(empresa,portal,document,occurred_local,vehicle,kind,liters_milli,amount_signed,actor,import_source)
   values('EMINSG',item->>'portal',item->>'document',(item->>'occurred_local')::timestamp,item->>'vehicle','Carga',(item->>'liters_milli')::bigint,(item->>'amount_signed')::bigint,owner_id,'authorized_admin_import') returning id into new_id;
   ids:=array_append(ids,new_id);
  end if;
 end loop;
 if jsonb_array_length(p_rows)>0 then
  insert into public.enex_import_receipts(empresa,actor,received,inserted,repeated,import_source)
  values('EMINSG',owner_id,jsonb_array_length(p_rows),cardinality(ids),repeated_count,'authorized_admin_import');
 end if;
 insert into public.enex_automation_runs(id,evidence,payload,new_ids,repeated,status)
 values(p_run,p_evidence,p_rows,ids,repeated_count,case when cardinality(ids)>0 then 'imported' else 'no_new' end)
 returning * into previous;
 return to_jsonb(previous)-'payload';
end;$$;
revoke all on function public.enex_import_server(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.enex_import_server(uuid,jsonb,jsonb) to service_role;
-- Only the authenticated administrative connector can call this bridge. The
-- existing Vault secret never leaves the server or appears in the return value.
create function private.enex_submit_read(p_body jsonb) returns bigint
language sql security invoker set search_path='' as $$
 select net.http_post(
  url:='https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/enex-automation',
  headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
   (select decrypted_secret from vault.decrypted_secrets where name='obraxis_cron_secret')),
  body:=p_body,timeout_milliseconds:=30000);
$$;
revoke all on function private.enex_submit_read(jsonb) from public,anon,authenticated,service_role;
commit;
