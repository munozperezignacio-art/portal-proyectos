create or replace function public.inicializar_expediente_mandante()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.exige_acreditacion then
    if coalesce((new.alcance_acreditacion->>'empresa')::boolean,false) then insert into public.mandante_acreditaciones(contrato_id,empresa_mandante,categoria) values(new.id,new.empresa_mandante,'Empresa') on conflict do nothing; end if;
    if coalesce((new.alcance_acreditacion->>'personal')::boolean,false) then insert into public.mandante_acreditaciones(contrato_id,empresa_mandante,categoria) values(new.id,new.empresa_mandante,'Personal') on conflict do nothing; end if;
    if coalesce((new.alcance_acreditacion->>'equipos')::boolean,false) then insert into public.mandante_acreditaciones(contrato_id,empresa_mandante,categoria) values(new.id,new.empresa_mandante,'Equipos') on conflict do nothing; end if;
  end if;
  insert into public.mandante_obligaciones(contrato_id,empresa_mandante,tipo,nombre,periodicidad,responsable)
  select new.id,new.empresa_mandante,x.tipo,x.nombre,x.periodicidad,new.contacto_nombre
  from (values
    ('Avance','Informe de avance',coalesce(new.periodicidad->>'avance','Semanal'),coalesce((new.paquetes->>'avance')::boolean,false)),
    ('Programacion','ActualizaciÃ³n de programaciÃ³n','Semanal',coalesce((new.paquetes->>'programacion')::boolean,false)),
    ('Estado de pago','Estado de pago','Mensual',coalesce((new.paquetes->>'estados_pago')::boolean,false)),
    ('Prevencion','Informe de prevenciÃ³n',coalesce(new.periodicidad->>'prevencion','Mensual'),coalesce((new.paquetes->>'prevencion')::boolean,false)),
    ('Calidad','Informe de calidad',coalesce(new.periodicidad->>'calidad','Por evento'),coalesce((new.paquetes->>'calidad')::boolean,false))
  ) as x(tipo,nombre,periodicidad,habilitada) where x.habilitada;
  return new;
end; $$;

drop trigger if exists trg_inicializar_expediente_mandante on public.mandante_contratos;
create trigger trg_inicializar_expediente_mandante after insert on public.mandante_contratos
for each row execute function public.inicializar_expediente_mandante();

;
