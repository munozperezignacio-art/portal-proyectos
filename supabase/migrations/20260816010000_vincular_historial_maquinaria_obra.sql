alter table public.maquinaria_fallas add column if not exists obra_nombre text;
alter table public.maquinaria_mantenciones add column if not exists obra_nombre text;

update public.maquinaria_fallas as registro
set obra_nombre = equipo.obra_nombre
from public.inventario_maquinaria as equipo
where registro.equipo_id = equipo.id and registro.empresa = equipo.empresa and registro.obra_nombre is null;

update public.maquinaria_mantenciones as registro
set obra_nombre = equipo.obra_nombre
from public.inventario_maquinaria as equipo
where registro.equipo_id = equipo.id and registro.empresa = equipo.empresa and registro.obra_nombre is null;

create index if not exists maquinaria_fallas_empresa_equipo_obra_idx
  on public.maquinaria_fallas (empresa, equipo_id, obra_nombre, fecha desc);
create index if not exists maquinaria_mantenciones_empresa_equipo_obra_idx
  on public.maquinaria_mantenciones (empresa, equipo_id, obra_nombre, fecha desc);
