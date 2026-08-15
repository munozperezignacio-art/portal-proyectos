-- Control contractual estructurado del mandante y conversión monetaria trazable.

create table if not exists public.mandante_plantillas_entrega (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.mandante_contratos(id) on delete restrict,
  empresa_mandante text not null,
  apartado text not null check (apartado in ('Avance','Programacion','Hito','Estado de pago','RDI','Libro de obra','Calidad','Prevencion','Documento','Acreditacion')),
  nombre text not null,
  instrucciones text,
  campos jsonb not null default '[]'::jsonb check (jsonb_typeof(campos)='array'),
  formatos_permitidos text[] not null default array['pdf','jpg','jpeg','png','xlsx','docx']::text[],
  max_archivos integer not null default 5 check (max_archivos between 0 and 10),
  documento_obligatorio boolean not null default false,
  activa boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contrato_id, apartado, nombre)
);

create table if not exists public.mandante_control_partidas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.mandante_contratos(id) on delete restrict,
  empresa_mandante text not null,
  codigo text,
  partida text not null,
  unidad text not null default 'UN',
  cantidad_contratada numeric not null default 0 check (cantidad_contratada >= 0),
  precio_unitario numeric not null default 0 check (precio_unitario >= 0),
  moneda text not null default 'CLP' check (moneda in ('CLP','UF','USD')),
  fecha_inicio date,
  fecha_termino date,
  ponderacion_pct numeric not null default 0 check (ponderacion_pct between 0 and 100),
  orden integer not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mandante_entregas
  add column if not exists plantilla_id uuid references public.mandante_plantillas_entrega(id) on delete restrict,
  add column if not exists partida_control_id uuid references public.mandante_control_partidas(id) on delete restrict;

alter table public.presupuestos_proyectos
  add column if not exists moneda_base text not null default 'CLP' check (moneda_base in ('CLP','UF','USD'));

alter table public.estados_pago_obra
  add column if not exists moneda_contrato text not null default 'CLP' check (moneda_contrato in ('CLP','UF','USD')),
  add column if not exists tipo_cambio_clp numeric not null default 1 check (tipo_cambio_clp > 0),
  add column if not exists fecha_tipo_cambio date,
  add column if not exists fuente_tipo_cambio text,
  add column if not exists monto_bruto_moneda_origen numeric,
  add column if not exists monto_neto_moneda_origen numeric;

create index if not exists mandante_plantillas_contrato_idx on public.mandante_plantillas_entrega(contrato_id, activa, orden);
create index if not exists mandante_control_partidas_contrato_idx on public.mandante_control_partidas(contrato_id, activa, orden);

alter table public.mandante_plantillas_entrega enable row level security;
alter table public.mandante_control_partidas enable row level security;
revoke all on public.mandante_plantillas_entrega, public.mandante_control_partidas from anon;
grant select,insert,update,delete on public.mandante_plantillas_entrega, public.mandante_control_partidas to authenticated;

create policy mandante_plantillas_select_empresas on public.mandante_plantillas_entrega for select to authenticated
using (exists(select 1 from public.mandante_contratos c where c.id=contrato_id and ((select private.usuario_puede_empresa(c.empresa_mandante)) or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))))));
create policy mandante_plantillas_insert_mandante on public.mandante_plantillas_entrega for insert to authenticated with check ((select private.usuario_puede_empresa(empresa_mandante)));
create policy mandante_plantillas_update_mandante on public.mandante_plantillas_entrega for update to authenticated using ((select private.usuario_puede_empresa(empresa_mandante))) with check ((select private.usuario_puede_empresa(empresa_mandante)));
create policy mandante_plantillas_delete_mandante on public.mandante_plantillas_entrega for delete to authenticated using ((select private.usuario_puede_empresa(empresa_mandante)));
create policy mandante_control_partidas_select_empresas on public.mandante_control_partidas for select to authenticated
using (exists(select 1 from public.mandante_contratos c where c.id=contrato_id and ((select private.usuario_puede_empresa(c.empresa_mandante)) or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))))));
create policy mandante_control_partidas_insert_mandante on public.mandante_control_partidas for insert to authenticated with check ((select private.usuario_puede_empresa(empresa_mandante)));
create policy mandante_control_partidas_update_mandante on public.mandante_control_partidas for update to authenticated using ((select private.usuario_puede_empresa(empresa_mandante))) with check ((select private.usuario_puede_empresa(empresa_mandante)));
create policy mandante_control_partidas_delete_mandante on public.mandante_control_partidas for delete to authenticated using ((select private.usuario_puede_empresa(empresa_mandante)));

create or replace function private.inicializar_plantillas_mandante()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item record;
begin
  for item in select * from (values
    ('Avance','Avance físico por partida','Selecciona la partida contractual e informa el avance del período.',
      '[{"key":"cantidad_periodo","label":"Cantidad ejecutada en el período","type":"number","required":true},{"key":"cantidad_acumulada","label":"Cantidad acumulada","type":"number","required":true},{"key":"fecha_medicion","label":"Fecha de medición","type":"date","required":true},{"key":"observacion","label":"Observación","type":"textarea","required":false}]'::jsonb,false),
    ('Programacion','Actualización de programación','Informa hitos, restricciones o reprogramaciones y adjunta el programa actualizado.',
      '[{"key":"fecha_estado","label":"Fecha de estado","type":"date","required":true},{"key":"causa_desviacion","label":"Causa de desviación","type":"textarea","required":false},{"key":"medida_recuperacion","label":"Medida de recuperación","type":"textarea","required":false}]'::jsonb,true),
    ('Estado de pago','Estado de pago contractual','Adjunta el estado de pago y registra el período y monto presentado.',
      '[{"key":"numero_ep","label":"Número de estado de pago","type":"number","required":true},{"key":"fecha_presentacion","label":"Fecha de presentación","type":"date","required":true},{"key":"monto_presentado","label":"Monto presentado","type":"money","required":true}]'::jsonb,true),
    ('Documento','Documentación contractual','Carga el documento solicitado e identifica tipo, vigencia y observaciones.',
      '[{"key":"tipo_documento","label":"Tipo de documento","type":"text","required":true},{"key":"fecha_documento","label":"Fecha del documento","type":"date","required":true},{"key":"vigencia_hasta","label":"Vigencia hasta","type":"date","required":false}]'::jsonb,true),
    ('Calidad','Registro de calidad','Entrega protocolos, recepciones, certificados o no conformidades.',
      '[{"key":"tipo_registro","label":"Tipo de registro","type":"text","required":true},{"key":"fecha_registro","label":"Fecha","type":"date","required":true},{"key":"resultado","label":"Resultado","type":"text","required":true}]'::jsonb,true),
    ('Prevencion','Registro de prevención','Entrega registros preventivos, incidentes o indicadores del período.',
      '[{"key":"tipo_registro","label":"Tipo de registro","type":"text","required":true},{"key":"fecha_registro","label":"Fecha","type":"date","required":true},{"key":"observacion","label":"Observación","type":"textarea","required":false}]'::jsonb,true),
    ('Acreditacion','Expediente de acreditación','Carga antecedentes de empresa, personal o equipos requeridos.',
      '[{"key":"categoria","label":"Categoría","type":"select","required":true,"options":["Empresa","Personal","Equipos"]},{"key":"vigencia_hasta","label":"Vigencia hasta","type":"date","required":false}]'::jsonb,true)
  ) as v(apartado,nombre,instrucciones,campos,documento_obligatorio)
  loop
    if coalesce(new.paquetes ->> lower(replace(item.apartado,' ','_')), 'true') <> 'false' then
      insert into public.mandante_plantillas_entrega(contrato_id,empresa_mandante,apartado,nombre,instrucciones,campos,documento_obligatorio)
      values(new.id,new.empresa_mandante,item.apartado,item.nombre,item.instrucciones,item.campos,item.documento_obligatorio)
      on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists trg_inicializar_plantillas_mandante on public.mandante_contratos;
create trigger trg_inicializar_plantillas_mandante after insert on public.mandante_contratos
for each row execute function private.inicializar_plantillas_mandante();

-- Contratos existentes reciben plantillas diferenciadas sin alterar entregas previas.
insert into public.mandante_plantillas_entrega(contrato_id,empresa_mandante,apartado,nombre,instrucciones,campos,documento_obligatorio)
select c.id,c.empresa_mandante,v.apartado,v.nombre,v.instrucciones,v.campos,v.documento_obligatorio
from public.mandante_contratos c
cross join (values
  ('Avance','Avance físico por partida','Selecciona la partida contractual e informa el avance del período.','[{"key":"cantidad_periodo","label":"Cantidad ejecutada en el período","type":"number","required":true},{"key":"cantidad_acumulada","label":"Cantidad acumulada","type":"number","required":true},{"key":"fecha_medicion","label":"Fecha de medición","type":"date","required":true}]'::jsonb,false),
  ('Programacion','Actualización de programación','Informa desviaciones y adjunta el programa actualizado.','[{"key":"fecha_estado","label":"Fecha de estado","type":"date","required":true},{"key":"causa_desviacion","label":"Causa de desviación","type":"textarea","required":false},{"key":"medida_recuperacion","label":"Medida de recuperación","type":"textarea","required":false}]'::jsonb,true),
  ('Estado de pago','Estado de pago contractual','Registra el período, monto presentado y adjunta el documento.','[{"key":"numero_ep","label":"Número de estado de pago","type":"number","required":true},{"key":"fecha_presentacion","label":"Fecha de presentación","type":"date","required":true},{"key":"monto_presentado","label":"Monto presentado","type":"money","required":true}]'::jsonb,true),
  ('Documento','Documentación contractual','Carga el documento solicitado e identifica su vigencia.','[{"key":"tipo_documento","label":"Tipo de documento","type":"text","required":true},{"key":"fecha_documento","label":"Fecha del documento","type":"date","required":true},{"key":"vigencia_hasta","label":"Vigencia hasta","type":"date","required":false}]'::jsonb,true),
  ('Calidad','Registro de calidad','Entrega protocolos, recepciones, certificados o no conformidades.','[{"key":"tipo_registro","label":"Tipo de registro","type":"text","required":true},{"key":"fecha_registro","label":"Fecha","type":"date","required":true},{"key":"resultado","label":"Resultado","type":"text","required":true}]'::jsonb,true),
  ('Prevencion','Registro de prevención','Entrega registros preventivos, incidentes o indicadores.','[{"key":"tipo_registro","label":"Tipo de registro","type":"text","required":true},{"key":"fecha_registro","label":"Fecha","type":"date","required":true},{"key":"observacion","label":"Observación","type":"textarea","required":false}]'::jsonb,true),
  ('Acreditacion','Expediente de acreditación','Carga antecedentes de empresa, personal o equipos.','[{"key":"categoria","label":"Categoría","type":"select","required":true,"options":["Empresa","Personal","Equipos"]},{"key":"vigencia_hasta","label":"Vigencia hasta","type":"date","required":false}]'::jsonb,true)
) as v(apartado,nombre,instrucciones,campos,documento_obligatorio)
on conflict do nothing;
