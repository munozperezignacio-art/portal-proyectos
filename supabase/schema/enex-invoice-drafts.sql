-- Persist reviewed invoices and their private PDF while assignments are pending.
-- Saving a draft never reserves guides, posts costs or changes assignments.
begin;
create table public.enex_invoice_drafts (
 id uuid primary key,
 empresa text not null,
 issuer_rut text not null,
 document text not null,
 portal text not null check(portal in ('empresa','transporte')),
 source_path text not null unique,
 invoice jsonb not null,
 revision integer not null default 1 check(revision>0),
 created_by uuid not null default auth.uid(),
 updated_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 emitted_at timestamptz,
 unique(empresa,issuer_rut,document)
);
create index enex_invoice_drafts_pending on public.enex_invoice_drafts(empresa,created_at desc,id) where emitted_at is null;
alter table public.enex_invoice_drafts enable row level security;
revoke all on public.enex_invoice_drafts from public,anon,authenticated;
grant select on public.enex_invoice_drafts to authenticated;
create policy enex_invoice_drafts_read on public.enex_invoice_drafts for select to authenticated
 using(private.enex_allowed(empresa,'ver') and private.enex_allowed(empresa,'importar'));

create function private.enex_invoice_save_draft(p_id uuid,p_invoice jsonb,p_revision integer) returns public.enex_invoice_drafts
language plpgsql security definer set search_path='' as $$
declare existing public.enex_invoice_drafts;path text;
begin
 if auth.uid() is null or not private.enex_allowed(p_invoice->>'empresa','ver') or not private.enex_allowed(p_invoice->>'empresa','importar') then raise exception 'Sin permiso para guardar facturas ENEX';end if;
 if p_id is null then raise exception 'Identificador requerido';end if;
 perform pg_advisory_xact_lock(hashtextextended('enex-invoice:'||(p_invoice->>'empresa'),0));
 if exists(select 1 from public.enex_invoices where empresa=p_invoice->>'empresa' and issuer_rut=p_invoice->>'issuer_rut' and document=p_invoice->>'document') then raise exception 'Esta factura ya fue emitida. Descárguela desde el historial';end if;
 select * into existing from public.enex_invoice_drafts where id=p_id for update;
 if found then
  if existing.empresa is distinct from p_invoice->>'empresa' or existing.issuer_rut is distinct from p_invoice->>'issuer_rut' or existing.document is distinct from p_invoice->>'document' then raise exception 'La identidad de la factura guardada no puede cambiar';end if;
  if existing.emitted_at is not null then raise exception 'Factura ya emitida';end if;
  if existing.invoice=p_invoice then return existing;end if;
  if p_revision is distinct from existing.revision then raise exception 'La factura fue modificada por otro usuario. Reábrala desde Pendientes';end if;
 else
  if exists(select 1 from public.enex_invoice_drafts where empresa=p_invoice->>'empresa' and issuer_rut=p_invoice->>'issuer_rut' and document=p_invoice->>'document') then raise exception 'Esta factura ya está guardada. Ábrala desde Facturas pendientes; no vuelva a subir el PDF';end if;
  if coalesce(p_revision,0)<>0 then raise exception 'Factura pendiente no encontrada';end if;
 end if;
 -- Validates invoice fields/totals even when guides are still unassigned or missing.
 perform private.enex_invoice_reconcile(p_invoice);
 if existing.id is not null then
  update public.enex_invoice_drafts set invoice=p_invoice,portal=p_invoice->>'portal',revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning * into existing;
 else
  path:=(p_invoice->>'empresa')||'/'||p_id::text||'/source.pdf';
  if not exists(select 1 from storage.objects where bucket_id='enex-invoices' and name=path and owner_id=auth.uid()::text) then raise exception 'PDF original no disponible para guardar la factura';end if;
  insert into public.enex_invoice_drafts(id,empresa,issuer_rut,document,portal,source_path,invoice)
  values(p_id,p_invoice->>'empresa',p_invoice->>'issuer_rut',p_invoice->>'document',p_invoice->>'portal',path,p_invoice) returning * into existing;
 end if;
 return existing;
end;$$;
revoke all on function private.enex_invoice_save_draft(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function private.enex_invoice_save_draft(uuid,jsonb,integer) to authenticated;
create function public.save_enex_invoice_draft(p_id uuid,p_invoice jsonb,p_revision integer) returns public.enex_invoice_drafts
language sql security invoker set search_path='' as $$select private.enex_invoice_save_draft(p_id,p_invoice,p_revision)$$;
revoke all on function public.save_enex_invoice_draft(uuid,jsonb,integer) from public,anon;
grant execute on function public.save_enex_invoice_draft(uuid,jsonb,integer) to authenticated;
commit;
