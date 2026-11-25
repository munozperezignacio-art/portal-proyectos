-- Local-tested schema contract. Not applied to production.
-- Uses the existing ENEX company/role authorization helper.
begin;
create table public.enex_invoice_rules (
 empresa text primary key,
 machinery_threshold_milli bigint not null default 180000 check(machinery_threshold_milli between 1 and 100000000),
 revision bigint not null default 1,
 updated_at timestamptz not null default now(),
 actor uuid not null default auth.uid()
);
alter table public.enex_invoice_rules enable row level security;
revoke all on public.enex_invoice_rules from public,anon,authenticated;
grant select on public.enex_invoice_rules to authenticated;
grant insert(empresa,machinery_threshold_milli),update(machinery_threshold_milli) on public.enex_invoice_rules to authenticated;
create policy enex_invoice_rules_read on public.enex_invoice_rules for select to authenticated
 using(private.enex_allowed(empresa,'ver'));
create policy enex_invoice_rules_insert on public.enex_invoice_rules for insert to authenticated
 with check(private.enex_allowed(empresa,'editar') and private.enex_allowed(empresa,'ver') and actor=auth.uid());
create policy enex_invoice_rules_update on public.enex_invoice_rules for update to authenticated
 using(private.enex_allowed(empresa,'editar') and private.enex_allowed(empresa,'ver'))
 with check(private.enex_allowed(empresa,'editar') and private.enex_allowed(empresa,'ver') and actor=auth.uid());

create table public.enex_invoice_rules_audit (
 id uuid primary key default gen_random_uuid(),
 empresa text not null references public.enex_invoice_rules(empresa),
 revision bigint not null,
 previous_threshold_milli bigint,
 machinery_threshold_milli bigint not null,
 actor uuid not null default auth.uid(),
 happened_at timestamptz not null default now(),
 unique(empresa,revision)
);
alter table public.enex_invoice_rules_audit enable row level security;
revoke all on public.enex_invoice_rules_audit from public,anon,authenticated;
grant select on public.enex_invoice_rules_audit to authenticated;
grant insert(empresa,revision,previous_threshold_milli,machinery_threshold_milli) on public.enex_invoice_rules_audit to authenticated;
create policy enex_invoice_rules_audit_read on public.enex_invoice_rules_audit for select to authenticated
 using(private.enex_allowed(empresa,'ver'));
create policy enex_invoice_rules_audit_insert on public.enex_invoice_rules_audit for insert to authenticated
 with check(private.enex_allowed(empresa,'editar') and actor=auth.uid() and pg_trigger_depth()>0);

create function private.enex_invoice_rules_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if new.empresa<>old.empresa then raise exception 'Empresa inmutable'; end if;
   new.revision:=old.revision+1;
 else new.revision:=1;
 end if;
 new.actor:=auth.uid();new.updated_at:=now();
 return new;
end;$$;
revoke all on function private.enex_invoice_rules_guard() from public,anon,authenticated;
create trigger enex_invoice_rules_guard before insert or update on public.enex_invoice_rules
 for each row execute function private.enex_invoice_rules_guard();

create function private.enex_invoice_rules_audit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.enex_invoice_rules_audit(empresa,revision,previous_threshold_milli,machinery_threshold_milli)
 values(new.empresa,new.revision,case when tg_op='UPDATE' then old.machinery_threshold_milli else null end,new.machinery_threshold_milli);
 return new;
end;$$;
revoke all on function private.enex_invoice_rules_audit() from public,anon,authenticated;
create trigger enex_invoice_rules_audit after insert or update on public.enex_invoice_rules
 for each row execute function private.enex_invoice_rules_audit();
commit;
