-- Optional, source-verified station metadata. Core identity and assignments remain unchanged.
begin;
alter table public.enex_movements
 add column station text check(station is null or (length(station) between 1 and 250 and station=btrim(station))),
 add column station_commune text check(station_commune is null or (length(station_commune) between 1 and 120 and station_commune=btrim(station_commune)));
grant insert(station,station_commune) on public.enex_movements to authenticated;
CREATE OR REPLACE FUNCTION public.enex_import_server(p_run uuid, p_rows jsonb, p_evidence jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
   or (item-'portal'-'document'-'occurred_local'-'vehicle'-'kind'-'liters_milli'-'amount_signed'-'station'-'station_commune')<>'{}'::jsonb
  then raise exception 'Invalid movement'; end if;
  if (item ? 'station' and jsonb_typeof(item->'station') not in ('string','null'))
   or (item ? 'station_commune' and jsonb_typeof(item->'station_commune') not in ('string','null'))
  then raise exception 'Invalid station metadata'; end if;
  select * into existing from public.enex_movements where empresa='EMINSG' and portal=item->>'portal' and document=item->>'document';
  if found then
   if (existing.station is not null and item->>'station' is not null and existing.station<>item->>'station')
    or (existing.station_commune is not null and item->>'station_commune' is not null and existing.station_commune<>item->>'station_commune')
   then raise exception 'Conflicting station metadata'; end if;
   if existing.occurred_local is distinct from (item->>'occurred_local')::timestamp
    or existing.vehicle is distinct from item->>'vehicle'
    or existing.liters_milli is distinct from (item->>'liters_milli')::bigint
    or existing.amount_signed is distinct from (item->>'amount_signed')::bigint
    or existing.kind is distinct from item->>'kind' then raise exception 'Conflicting movement; rolled back'; end if;
   repeated_count:=repeated_count+1;
  else
   insert into public.enex_movements(empresa,portal,document,occurred_local,vehicle,kind,liters_milli,amount_signed,actor,import_source,station,station_commune)
   values('EMINSG',item->>'portal',item->>'document',(item->>'occurred_local')::timestamp,item->>'vehicle','Carga',(item->>'liters_milli')::bigint,(item->>'amount_signed')::bigint,owner_id,'authorized_admin_import',item->>'station',item->>'station_commune') returning id into new_id;
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
end;$function$;

CREATE OR REPLACE FUNCTION public.enex_my_pending(p_company text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'vehicle',vehicle,'portal',portal,'document',document,'date',occurred_local,'amount',-amount_signed,'station',(select m.station from public.enex_movements m where m.id=enex_pending_owned.id),'station_commune',(select m.station_commune from public.enex_movements m where m.id=enex_pending_owned.id)) order by occurred_local desc) from private.enex_pending_owned where empresa=p_company and owner_id=auth.uid()),'[]'::jsonb),
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',nombre,'code',codigo) order by codigo) from public.facturacion_centros_gestion where empresa=p_company and activo and exists(select 1 from private.enex_pending_owned where empresa=p_company and owner_id=auth.uid())),'[]'::jsonb));
$function$;

CREATE OR REPLACE FUNCTION public.import_enex_movements(p_company text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare item jsonb; stored public.enex_movements; moment timestamp; added integer:=0; repeated integer:=0;
begin
 if auth.uid() is null or private.enex_allowed(p_company,'ver') is not true or private.enex_allowed(p_company,'importar') is not true then raise exception 'Not authorized';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Invalid batch';end if;
 -- Serialize company imports. Unique key remains the final concurrency constraint.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('enex:'||p_company,0));
 for item in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(item) is distinct from 'object' or not (item ?& array['portal','document','occurred_local','vehicle','kind','liters_milli','amount_signed'])
   or (item-'portal'-'document'-'occurred_local'-'vehicle'-'kind'-'liters_milli'-'amount_signed'-'station'-'station_commune')<>'{}'::jsonb
   or jsonb_typeof(item->'portal') is distinct from 'string' or jsonb_typeof(item->'document') is distinct from 'string'
   or jsonb_typeof(item->'vehicle') is distinct from 'string' or jsonb_typeof(item->'kind') is distinct from 'string'
   or jsonb_typeof(item->'occurred_local') is distinct from 'string'
   or jsonb_typeof(item->'liters_milli') is distinct from 'number' or jsonb_typeof(item->'amount_signed') is distinct from 'number'
   or (item->>'occurred_local') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
   or (item->>'liters_milli') !~ '^[0-9]+$' or (item->>'amount_signed') !~ '^-[0-9]+$'
   then raise exception 'Invalid movement';end if;
  if (item ? 'station' and jsonb_typeof(item->'station') not in ('string','null'))
   or (item ? 'station_commune' and jsonb_typeof(item->'station_commune') not in ('string','null'))
  then raise exception 'Invalid station metadata'; end if;
  moment:=(item->>'occurred_local')::timestamp;
  select * into stored from public.enex_movements where empresa=p_company and portal=item->>'portal' and document=item->>'document';
  if found then
   if (stored.station is not null and item->>'station' is not null and stored.station<>item->>'station')
    or (stored.station_commune is not null and item->>'station_commune' is not null and stored.station_commune<>item->>'station_commune')
   then raise exception 'Conflicting station metadata'; end if;
   if stored.occurred_local<>moment or stored.vehicle is distinct from item->>'vehicle' or stored.liters_milli<>(item->>'liters_milli')::bigint or stored.amount_signed<>(item->>'amount_signed')::bigint or stored.kind is distinct from item->>'kind' then raise exception 'Conflicting movement; batch rolled back';end if;
   repeated:=repeated+1;
  else
   insert into public.enex_movements(empresa,portal,document,occurred_local,vehicle,kind,liters_milli,amount_signed,station,station_commune)
   values(p_company,item->>'portal',item->>'document',moment,item->>'vehicle',item->>'kind',(item->>'liters_milli')::bigint,(item->>'amount_signed')::bigint,item->>'station',item->>'station_commune');
   added:=added+1;
  end if;
 end loop;
 insert into public.enex_import_receipts(empresa,received,inserted,repeated) values(p_company,jsonb_array_length(p_rows),added,repeated);
 return jsonb_build_object('inserted',added,'repeated',repeated,'received',jsonb_array_length(p_rows));
end;$function$;

commit;

