-- Las relaciones heredadas usaban únicamente el nombre global de la obra.
-- Se reemplazan explícitamente por la identidad multiempresa.
alter table public.maestro_personal drop constraint if exists maestro_personal_obra_nombre_fkey;
alter table public.inventario_maquinaria drop constraint if exists inventario_maquinaria_obra_nombre_fkey;
alter table public.partidas_obra drop constraint if exists partidas_obra_obra_nombre_fkey;
alter table public.asistencia_personal drop constraint if exists asistencia_personal_obra_nombre_fkey;
alter table public.avances_produccion_partidas drop constraint if exists avances_produccion_partidas_obra_nombre_fkey;
alter table public.inventario_materiales drop constraint if exists inventario_materiales_obra_nombre_fkey;
alter table public.reporte_maquinaria drop constraint if exists reporte_maquinaria_obra_nombre_fkey;
alter table public.planificacion_tareas drop constraint if exists planificacion_tareas_obra_nombre_fkey;

-- Permite reutilizar el nombre de una obra en empresas distintas.
-- La identidad operativa sigue siendo única dentro de cada empresa.
alter table public.obras
  drop constraint if exists obras_nombre_key;

alter table public.obras
  drop constraint if exists obras_empresa_nombre_key,
  add constraint obras_empresa_nombre_key unique (empresa, nombre);

alter table public.maestro_personal
  add constraint maestro_personal_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
alter table public.inventario_maquinaria
  add constraint inventario_maquinaria_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
alter table public.partidas_obra
  add constraint partidas_obra_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
alter table public.asistencia_personal
  add constraint asistencia_personal_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
alter table public.avances_produccion_partidas
  add constraint avances_produccion_partidas_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
alter table public.inventario_materiales
  add constraint inventario_materiales_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
alter table public.reporte_maquinaria
  add constraint reporte_maquinaria_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
alter table public.planificacion_tareas
  add constraint planificacion_tareas_empresa_obra_nombre_fkey foreign key (empresa, obra_nombre)
  references public.obras (empresa, nombre) on update cascade on delete set null (obra_nombre);
