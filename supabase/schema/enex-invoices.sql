-- Immutable reconciliations. No writes to movements, assignments or accounting.
begin;
create table public.enex_invoices (
 id uuid primary key,
 empresa text not null,
 issuer_rut text not null,
 document text not null,
 portal text not null check(portal in ('empresa','transporte')),
 source_path text not null unique,
 invoice jsonb not null,
 reconciliation jsonb not null,
 actor uuid not null default auth.uid(),
 issued_at timestamptz not null default now(),
 unique(empresa,issuer_rut,document)
);
create index enex_invoices_company_date on public.enex_invoices(empresa,issued_at desc,id);
alter table public.enex_invoices enable row level security;
revoke all on public.enex_invoices from public,anon,authenticated;
grant select on public.enex_invoices to authenticated;
create policy enex_invoices_read on public.enex_invoices for select to authenticated using(private.enex_allowed(empresa,'ver'));
create table public.enex_invoice_guides (
 empresa text not null,portal text not null,document text not null,
 invoice_id uuid not null references public.enex_invoices(id),
 primary key(empresa,portal,document)
);
create index enex_invoice_guides_invoice on public.enex_invoice_guides(invoice_id);
alter table public.enex_invoice_guides enable row level security;
revoke all on public.enex_invoice_guides from public,anon,authenticated;
grant select on public.enex_invoice_guides to authenticated;
create policy enex_invoice_guides_read on public.enex_invoice_guides for select to authenticated using(private.enex_allowed(empresa,'ver'));

-- Largest remainder, identical signed integer allocation as the web preview.
create function private.enex_invoice_allocate(p_total bigint,p_rows jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 with weights as (
 select r->>'movement_id' as k,(r->>'original_liters_milli')::numeric as w from jsonb_array_elements(p_rows) r
 ), parts as (
 select k,floor(abs(p_total::numeric)*w/sum(w) over()) as base,
 mod(abs(p_total::numeric)*w,sum(w) over()) as remainder from weights
 ), ranked as (
 select *,row_number() over(order by remainder desc,k collate "C") as n,sum(base) over() as allocated from parts
 ) select jsonb_object_agg(k,(base+case when n<=abs(p_total::numeric)-allocated then 1 else 0 end)*sign(p_total)) from ranked;
$$;
revoke all on function private.enex_invoice_allocate(bigint,jsonb) from public,anon,authenticated;

create function private.enex_invoice_reconcile(p_invoice jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 company text:=p_invoice->>'empresa';portal_name text:=p_invoice->>'portal';
 threshold bigint;guide_count integer;original bigint;difference bigint;field text;
 rows_data jsonb;problems jsonb;alloc jsonb;groups_data jsonb;
begin
 if auth.uid() is null or not private.enex_allowed(company,'ver') or not private.enex_allowed(company,'importar') then raise exception 'Sin permiso para conciliar facturas ENEX';end if;
 if coalesce(portal_name,'') not in ('empresa','transporte') or coalesce(p_invoice->>'document','') !~ '^[0-9]{1,30}$'
 or coalesce(p_invoice->>'issuer_rut','')<>'92011000-2'
 or coalesce(p_invoice->>'receiver_rut','') !~ '^[0-9]{7,8}-[0-9K]$'
 or (company='EMINSG' and p_invoice->>'receiver_rut'<>'96725910-1')
 or coalesce(p_invoice->>'account','') !~ '^[0-9]{1,7}$'
 or coalesce(p_invoice->>'date','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
 or coalesce(p_invoice->>'due_date','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
 then raise exception 'Revise factura, receptor, fechas, cuenta y portal';end if;
 if (p_invoice->>'date')::date>(p_invoice->>'due_date')::date then raise exception 'Vencimiento anterior a emisión';end if;
 foreach field in array array['liters_milli','fuel_net','shellcard_net','net','vat','specific_tax','exempt','total'] loop
 if coalesce(p_invoice->>field,'') !~ '^-?[0-9]+$' or abs((p_invoice->>field)::numeric)>1000000000000 then raise exception 'Importe o litros inválidos: %',field;end if;
 end loop;
 if (p_invoice->>'liters_milli')::bigint<=0 or (p_invoice->>'fuel_net')::bigint<0 or (p_invoice->>'net')::bigint<0 or (p_invoice->>'vat')::bigint<0 or (p_invoice->>'exempt')::bigint<0 or (p_invoice->>'total')::bigint<0
 or (p_invoice->>'fuel_net')::bigint+(p_invoice->>'shellcard_net')::bigint<>(p_invoice->>'net')::bigint
 or (p_invoice->>'net')::bigint+(p_invoice->>'vat')::bigint+(p_invoice->>'specific_tax')::bigint+(p_invoice->>'exempt')::bigint<>(p_invoice->>'total')::bigint then raise exception 'Los importes no cuadran con la factura';end if;
 if jsonb_typeof(p_invoice->'guides') is distinct from 'array' then raise exception 'Guías requeridas';end if;
 guide_count:=jsonb_array_length(p_invoice->'guides');
 if guide_count not between 1 and 10000 or exists(select 1 from jsonb_array_elements_text(p_invoice->'guides') g where g !~ '^[0-9]{1,30}$')
 or (select count(distinct g) from jsonb_array_elements_text(p_invoice->'guides') g)<>guide_count then raise exception 'Guías vacías, inválidas o repetidas';end if;
 -- Lock only the referenced source rows for the duration of preview/issue.
 perform m.id from public.enex_movements m where m.empresa=company and m.portal=portal_name and m.document in (select jsonb_array_elements_text(p_invoice->'guides')) order by m.id for share;
 perform a.movement_id from public.enex_assignments a join public.enex_movements m on m.id=a.movement_id where m.empresa=company and m.portal=portal_name and m.document in (select jsonb_array_elements_text(p_invoice->'guides')) order by a.movement_id for share of a;
 perform o.id from public.obras o join public.enex_assignments a on a.obra_id=o.id join public.enex_movements m on m.id=a.movement_id where m.empresa=company and m.portal=portal_name and m.document in (select jsonb_array_elements_text(p_invoice->'guides')) order by o.id for share of o;
 perform c.id from public.facturacion_centros_gestion c where c.empresa=company order by c.id for share;
 select machinery_threshold_milli into threshold from public.enex_invoice_rules where empresa=company for share;
 threshold:=coalesce(threshold,180000);
 with matched as (
 select g.document,m.id,m.vehicle,m.liters_milli,a.movement_id,a.empresa as assignment_company,a.obra_id,
 o.id as work_id,o.empresa as work_company,o.centro_gestion_id as work_center,
 c.id as center_id,c.codigo,c.nombre,c.activo,c.empresa as center_company,
 ig.invoice_id
 from jsonb_array_elements_text(p_invoice->'guides') g(document)
 left join public.enex_movements m on m.empresa=company and m.portal=portal_name and m.document=g.document
 left join public.enex_assignments a on a.movement_id=m.id
 left join public.obras o on o.id=a.obra_id
 left join public.facturacion_centros_gestion c on c.id=coalesce(a.centro_gestion_id,o.centro_gestion_id)
 left join public.enex_invoice_guides ig on ig.empresa=company and ig.portal=portal_name and ig.document=g.document
 ), checked as (
 select *,case when id is null then 'Guía sin movimiento'
 when invoice_id is not null then 'Guía ya utilizada en otra factura'
 when movement_id is null then 'Movimiento pendiente de asignación'
 when assignment_company<>company then 'Asignación incompatible'
 when obra_id is not null and (work_id is null or work_company<>company) then 'Obra no disponible'
 when center_id is null or center_company<>company or not activo or (obra_id is not null and work_center is distinct from center_id) then 'Centro no disponible o incompatible con la obra'
 when codigo !~ '^[0-9]{1,3}$' then 'Centro sin código numérico de hasta 3 dígitos para el formulario'
 when liters_milli<=0 then 'Litros inválidos' else null end as problem from matched
 ) select coalesce(jsonb_agg(jsonb_build_object('document',document,'message',problem)) filter(where problem is not null),'[]'),
 jsonb_agg(jsonb_build_object('movement_id',id,'document',document,'vehicle',vehicle,'center_id',center_id,'center_code',codigo,'center_name',nombre,'original_liters_milli',liters_milli,'classification',case when liters_milli>threshold then 'maquinaria' else 'camioneta' end) order by id) into problems,rows_data from checked;
 if jsonb_array_length(problems)>0 then return jsonb_build_object('ready',false,'problems',problems,'rows','[]'::jsonb,'groups','[]'::jsonb);end if;
 if jsonb_array_length(rows_data)<>guide_count then raise exception 'Coincidencias ambiguas';end if;
 select sum((r->>'original_liters_milli')::bigint) into original from jsonb_array_elements(rows_data) r;
 difference:=(p_invoice->>'liters_milli')::bigint-original;
 if abs(difference)>20000 then return jsonb_build_object('ready',false,'original_liters_milli',original,'difference_milli',difference,'problems',jsonb_build_array(jsonb_build_object('message','Desfase superior a ±20 litros')),'rows','[]'::jsonb,'groups','[]'::jsonb);end if;
 foreach field in array array['liters_milli','fuel_net','shellcard_net','vat','specific_tax','exempt'] loop
 alloc:=private.enex_invoice_allocate((p_invoice->>field)::bigint,rows_data);
 select jsonb_agg(r||jsonb_build_object(case when field='liters_milli' then 'adjusted_liters_milli' else field end,alloc->(r->>'movement_id')) order by r->>'movement_id') into rows_data from jsonb_array_elements(rows_data) r;
 end loop;
 select jsonb_agg(r||jsonb_build_object('adjustment_milli',(r->>'adjusted_liters_milli')::bigint-(r->>'original_liters_milli')::bigint,'net',(r->>'fuel_net')::bigint+(r->>'shellcard_net')::bigint,'total',(r->>'fuel_net')::bigint+(r->>'shellcard_net')::bigint+(r->>'vat')::bigint+(r->>'specific_tax')::bigint+(r->>'exempt')::bigint) order by r->>'movement_id') into rows_data from jsonb_array_elements(rows_data) r;
 select jsonb_agg(to_jsonb(g) order by center_id,classification) into groups_data from (
 select (r->>'center_id')::integer as center_id,r->>'center_code' as center_code,r->>'center_name' as center_name,r->>'classification' as classification,jsonb_agg(r->>'document' order by r->>'movement_id') as documents,
 sum((r->>'original_liters_milli')::bigint) as original_liters_milli,sum((r->>'adjusted_liters_milli')::bigint) as adjusted_liters_milli,sum((r->>'adjustment_milli')::bigint) as adjustment_milli,
 sum((r->>'fuel_net')::bigint) as fuel_net,sum((r->>'shellcard_net')::bigint) as shellcard_net,sum((r->>'vat')::bigint) as vat,sum((r->>'specific_tax')::bigint) as specific_tax,sum((r->>'exempt')::bigint) as exempt,sum((r->>'net')::bigint) as net,sum((r->>'total')::bigint) as total
 from jsonb_array_elements(rows_data) r group by r->>'center_id',r->>'center_code',r->>'center_name',r->>'classification') g;
 return jsonb_build_object('ready',true,'problems','[]'::jsonb,'rules',jsonb_build_object('machinery_threshold_milli',threshold),'original_liters_milli',original,'invoice_liters_milli',(p_invoice->>'liters_milli')::bigint,'difference_milli',difference,'rows',rows_data,'groups',groups_data);
end;$$;
revoke all on function private.enex_invoice_reconcile(jsonb) from public,anon,authenticated;
grant execute on function private.enex_invoice_reconcile(jsonb) to authenticated;
create function public.preview_enex_invoice(p_invoice jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.enex_invoice_reconcile(p_invoice)$$;
revoke all on function public.preview_enex_invoice(jsonb) from public,anon;
grant execute on function public.preview_enex_invoice(jsonb) to authenticated;

create function private.enex_invoice_issue(p_id uuid,p_invoice jsonb,p_expected jsonb) returns public.enex_invoices
language plpgsql security definer set search_path='' as $$
declare existing public.enex_invoices;result jsonb;path text;
begin
 if auth.uid() is null or not private.enex_allowed(p_invoice->>'empresa','ver') or not private.enex_allowed(p_invoice->>'empresa','importar') then raise exception 'Sin permiso para emitir facturas ENEX';end if;
 if p_id is null then raise exception 'Identificador requerido';end if;
 perform pg_advisory_xact_lock(hashtextextended('enex-invoice:'||(p_invoice->>'empresa'),0));
 select * into existing from public.enex_invoices where id=p_id;
 if found then
 if existing.empresa=p_invoice->>'empresa' and existing.invoice=p_invoice then return existing;end if;
 raise exception 'Identificador de emisión ya utilizado';end if;
 if exists(select 1 from public.enex_invoices where empresa=p_invoice->>'empresa' and issuer_rut=p_invoice->>'issuer_rut' and document=p_invoice->>'document') then raise exception 'Esta factura ya fue emitida. Descárguela desde el historial';end if;
 result:=private.enex_invoice_reconcile(p_invoice);
 if result->>'ready'<>'true' then raise exception 'La factura tiene guías pendientes o incompatibles. Vuelva a conciliar';end if;
 if result is distinct from p_expected then raise exception 'Las asignaciones o reglas cambiaron. Vuelva a conciliar y revisar';end if;
 path:=(p_invoice->>'empresa')||'/'||p_id::text||'/source.pdf';
 if not exists(select 1 from storage.objects where bucket_id='enex-invoices' and name=path and owner_id=auth.uid()::text) then raise exception 'PDF original no disponible para esta emisión';end if;
 insert into public.enex_invoices(id,empresa,issuer_rut,document,portal,source_path,invoice,reconciliation)
 values(p_id,p_invoice->>'empresa',p_invoice->>'issuer_rut',p_invoice->>'document',p_invoice->>'portal',path,p_invoice,result) returning * into existing;
 insert into public.enex_invoice_guides(empresa,portal,document,invoice_id) select existing.empresa,existing.portal,g,p_id from jsonb_array_elements_text(p_invoice->'guides') g;
 return existing;
end;$$;
revoke all on function private.enex_invoice_issue(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.enex_invoice_issue(uuid,jsonb,jsonb) to authenticated;
create function public.issue_enex_invoice(p_id uuid,p_invoice jsonb,p_expected jsonb) returns public.enex_invoices language sql security invoker set search_path='' as $$select private.enex_invoice_issue(p_id,p_invoice,p_expected)$$;
revoke all on function public.issue_enex_invoice(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.issue_enex_invoice(uuid,jsonb,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('enex-invoices','enex-invoices',false,10485760,array['application/pdf']);
create policy enex_invoice_pdf_read on storage.objects for select to authenticated using(bucket_id='enex-invoices' and private.enex_allowed((storage.foldername(name))[1],'ver'));
create policy enex_invoice_pdf_insert on storage.objects for insert to authenticated with check(bucket_id='enex-invoices' and private.enex_allowed((storage.foldername(name))[1],'ver') and private.enex_allowed((storage.foldername(name))[1],'importar') and owner_id=auth.uid()::text and name ~ '^[^/]+/[0-9a-f-]{36}/source\.pdf$' and not exists(select 1 from public.enex_invoices where source_path=name));
-- Restrictive guards also apply if another module has a permissive Storage policy.
create policy enex_invoice_pdf_read_guard on storage.objects as restrictive for select to authenticated using(bucket_id<>'enex-invoices' or private.enex_allowed((storage.foldername(name))[1],'ver'));
create policy enex_invoice_pdf_insert_guard on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'enex-invoices' or (private.enex_allowed((storage.foldername(name))[1],'ver') and private.enex_allowed((storage.foldername(name))[1],'importar') and owner_id=auth.uid()::text and name ~ '^[^/]+/[0-9a-f-]{36}/source\.pdf$'));
create policy enex_invoice_pdf_update_guard on storage.objects as restrictive for update to authenticated using(bucket_id<>'enex-invoices') with check(bucket_id<>'enex-invoices');
create policy enex_invoice_pdf_delete_guard on storage.objects as restrictive for delete to authenticated using(bucket_id<>'enex-invoices');
commit;
