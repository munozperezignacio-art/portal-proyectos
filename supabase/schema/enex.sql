-- Versioned Enex schema contract for review and offline structural tests.
-- No tenant data or credentials. Not an instruction to apply in production.
-- The production migration also includes deployment-specific preconditions and tenant scope.
-- DRAFT ONLY. Not applied. Generate a migration with the repository CLI after review.
-- Existing private.obraxis_actor_can_access_company and usuarios/roles are prerequisites.
begin;
create function private.enex_allowed(company text, action text) returns boolean
language sql stable security invoker set search_path = '' as $$
 select action in ('ver','importar','editar','enviar') and auth.uid() is not null
 and private.obraxis_actor_can_access_company(company) and exists (
 select 1 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
 where u.auth_user_id=auth.uid() and u.empresa=company and coalesce(r.archivado,false)=false
 and case
 when coalesce(u.permisos,'{}'::jsonb) ? ('maquinaria.enex.'||action) then u.permisos->('maquinaria.enex.'||action)='true'::jsonb
 else coalesce(r.permisos,'{}'::jsonb)->('maquinaria.enex.'||action)='true'::jsonb end);
$$;
revoke all on function private.enex_allowed(text,text) from public,anon;
grant execute on function private.enex_allowed(text,text) to authenticated;

create table public.enex_movements (
 id uuid primary key default gen_random_uuid(), empresa text not null,
 portal text not null check(portal in ('transporte','empresa')),
 document text not null check(document ~ '^[0-9]{1,30}$'),
 occurred_local timestamp without time zone not null,
 vehicle text not null check(length(vehicle) between 1 and 40 and vehicle=btrim(vehicle)),
 kind text not null check(kind='Carga'),
 liters_milli bigint not null check(liters_milli>0 and liters_milli<=100000000),
 amount_signed bigint not null check(amount_signed<0 and amount_signed>=-1000000000),
 currency text check(currency is null), -- unknown in current source adapter
 source_timezone text check(source_timezone is null), -- do not invent an offset
 tax_breakdown jsonb check(tax_breakdown is null),
 ingested_at timestamptz not null default now(), actor uuid not null default auth.uid(),
 import_source text not null default 'authenticated_ui' check(import_source in ('authenticated_ui','authorized_admin_import')),
 unique(empresa,portal,document), unique(empresa,id)
);
create index enex_movements_company_date on public.enex_movements(empresa,occurred_local desc);
alter table public.enex_movements enable row level security;
revoke all on public.enex_movements from public,anon,authenticated;
grant select on public.enex_movements to authenticated;
grant insert(empresa,portal,document,occurred_local,vehicle,kind,liters_milli,amount_signed) on public.enex_movements to authenticated;
create policy enex_read on public.enex_movements for select to authenticated using(private.enex_allowed(empresa,'ver'));
create policy enex_insert on public.enex_movements for insert to authenticated with check(private.enex_allowed(empresa,'importar') and actor=auth.uid());

create table public.enex_assignments (
 movement_id uuid primary key, empresa text not null,
 obra_id integer references public.obras(id), centro_gestion_id integer references public.facturacion_centros_gestion(id),
 note text not null default '' check(length(note)<=500),
 actor uuid not null default auth.uid(), updated_at timestamptz not null default now(),
 foreign key(empresa,movement_id) references public.enex_movements(empresa,id),
 check(obra_id is not null or centro_gestion_id is not null)
);
alter table public.enex_assignments enable row level security;
revoke all on public.enex_assignments from public,anon,authenticated;
grant select on public.enex_assignments to authenticated;
grant insert(movement_id,empresa,obra_id,centro_gestion_id,note),update(movement_id,empresa,obra_id,centro_gestion_id,note) on public.enex_assignments to authenticated;
create policy enex_assignment_read on public.enex_assignments for select to authenticated using(private.enex_allowed(empresa,'ver'));
create policy enex_assignment_insert on public.enex_assignments for insert to authenticated with check(private.enex_allowed(empresa,'editar') and actor=auth.uid());
create policy enex_assignment_update on public.enex_assignments for update to authenticated using(private.enex_allowed(empresa,'editar')) with check(private.enex_allowed(empresa,'editar') and actor=auth.uid());
create table public.enex_assignment_audit (
 id uuid primary key default gen_random_uuid(),empresa text not null,movement_id uuid not null,
 actor uuid not null default auth.uid(), happened_at timestamptz not null default now(),
 previous_assignment jsonb, new_assignment jsonb not null
);
alter table public.enex_assignment_audit enable row level security;
revoke all on public.enex_assignment_audit from public,anon,authenticated;
grant select on public.enex_assignment_audit to authenticated;
grant insert(empresa,movement_id,previous_assignment,new_assignment) on public.enex_assignment_audit to authenticated;
create policy enex_audit_read on public.enex_assignment_audit for select to authenticated using(private.enex_allowed(empresa,'ver'));
create policy enex_audit_insert on public.enex_assignment_audit for insert to authenticated with check(private.enex_allowed(empresa,'editar') and actor=auth.uid() and pg_trigger_depth()>0);

create function private.enex_validate_assignment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.empresa<>old.empresa or new.movement_id<>old.movement_id) then raise exception 'Assignment identity immutable'; end if;
 if new.obra_id is not null and not exists(select 1 from public.obras o where o.id=new.obra_id and o.empresa=new.empresa) then raise exception 'Work/company mismatch'; end if;
 if new.centro_gestion_id is not null and not exists(select 1 from public.facturacion_centros_gestion c where c.id=new.centro_gestion_id and c.empresa=new.empresa and c.activo) then raise exception 'Center/company mismatch'; end if;
 if new.obra_id is not null and new.centro_gestion_id is not null and not exists(select 1 from public.obras o where o.id=new.obra_id and o.centro_gestion_id=new.centro_gestion_id) then raise exception 'Work/center mismatch'; end if;
 if TG_OP='UPDATE' and new.obra_id is not distinct from old.obra_id and new.centro_gestion_id is not distinct from old.centro_gestion_id and new.note is not distinct from old.note then return null;end if;
 new.actor:=auth.uid();new.updated_at:=now();
 return new;
end;$$;
revoke all on function private.enex_validate_assignment() from public,anon,authenticated;
create trigger enex_assignment_guard before insert or update on public.enex_assignments for each row execute function private.enex_validate_assignment();

create function private.enex_audit_assignment() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.enex_assignment_audit(empresa,movement_id,previous_assignment,new_assignment)
 values(new.empresa,new.movement_id,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;$$;
revoke all on function private.enex_audit_assignment() from public,anon,authenticated;
create trigger enex_assignment_audit after insert or update on public.enex_assignments for each row execute function private.enex_audit_assignment();

create table public.enex_import_receipts (
 id uuid primary key default gen_random_uuid(), empresa text not null, actor uuid not null default auth.uid(),
 created_at timestamptz not null default now(), received integer not null, inserted integer not null, repeated integer not null,
 import_source text not null default 'authenticated_ui' check(import_source in ('authenticated_ui','authorized_admin_import')),
 check(received=inserted+repeated and received between 1 and 1000 and inserted>=0 and repeated>=0)
);
alter table public.enex_import_receipts enable row level security;
revoke all on public.enex_import_receipts from public,anon,authenticated;
grant select on public.enex_import_receipts to authenticated;
grant insert(empresa,received,inserted,repeated) on public.enex_import_receipts to authenticated;
create policy enex_receipt_read on public.enex_import_receipts for select to authenticated using(private.enex_allowed(empresa,'ver'));
create policy enex_receipt_insert on public.enex_import_receipts for insert to authenticated with check(private.enex_allowed(empresa,'importar') and actor=auth.uid());

create function public.import_enex_movements(p_company text,p_rows jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare item jsonb; stored public.enex_movements; moment timestamp; added integer:=0; repeated integer:=0;
begin
 if auth.uid() is null or private.enex_allowed(p_company,'ver') is not true or private.enex_allowed(p_company,'importar') is not true then raise exception 'Not authorized';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Invalid batch';end if;
 -- Serialize company imports. Unique key remains the final concurrency constraint.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('enex:'||p_company,0));
 for item in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(item) is distinct from 'object' or not (item ?& array['portal','document','occurred_local','vehicle','kind','liters_milli','amount_signed'])
   or (item-'portal'-'document'-'occurred_local'-'vehicle'-'kind'-'liters_milli'-'amount_signed')<>'{}'::jsonb
   or jsonb_typeof(item->'portal') is distinct from 'string' or jsonb_typeof(item->'document') is distinct from 'string'
   or jsonb_typeof(item->'vehicle') is distinct from 'string' or jsonb_typeof(item->'kind') is distinct from 'string'
   or jsonb_typeof(item->'occurred_local') is distinct from 'string'
   or jsonb_typeof(item->'liters_milli') is distinct from 'number' or jsonb_typeof(item->'amount_signed') is distinct from 'number'
   or (item->>'occurred_local') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
   or (item->>'liters_milli') !~ '^[0-9]+$' or (item->>'amount_signed') !~ '^-[0-9]+$'
   then raise exception 'Invalid movement';end if;
  moment:=(item->>'occurred_local')::timestamp;
  select * into stored from public.enex_movements where empresa=p_company and portal=item->>'portal' and document=item->>'document';
  if found then
   if stored.occurred_local<>moment or stored.vehicle is distinct from item->>'vehicle' or stored.liters_milli<>(item->>'liters_milli')::bigint or stored.amount_signed<>(item->>'amount_signed')::bigint or stored.kind is distinct from item->>'kind' then raise exception 'Conflicting movement; batch rolled back';end if;
   repeated:=repeated+1;
  else
   insert into public.enex_movements(empresa,portal,document,occurred_local,vehicle,kind,liters_milli,amount_signed)
   values(p_company,item->>'portal',item->>'document',moment,item->>'vehicle',item->>'kind',(item->>'liters_milli')::bigint,(item->>'amount_signed')::bigint);
   added:=added+1;
  end if;
 end loop;
 insert into public.enex_import_receipts(empresa,received,inserted,repeated) values(p_company,jsonb_array_length(p_rows),added,repeated);
 return jsonb_build_object('inserted',added,'repeated',repeated,'received',jsonb_array_length(p_rows));
end;$$;
revoke all on function public.import_enex_movements(text,jsonb) from public,anon;
grant execute on function public.import_enex_movements(text,jsonb) to authenticated;
commit;
