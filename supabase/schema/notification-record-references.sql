-- Preserve record references without changing recipients, channels or existing deliveries.
create or replace function private.route_role_notification(company text,code text,work text,title text,data jsonb,event_key text,owner text default null)
returns void language plpgsql security definer set search_path='' as $$
declare target record; setting jsonb; channels jsonb; safe_payload jsonb; channel text;
begin
 for target in select u.id,u.usuario,u.correo,u.rol,u.obras,n.role_id,n.settings->code config
 from public.role_notifications n join public.roles r on r.id=n.role_id and r.empresa=n.empresa and not coalesce(r.archivado,false)
 join public.usuarios u on u.empresa=r.empresa and u.rol=r.nombre
 where n.empresa=company and n.settings ? code loop
  setting:=target.config;
  if code in ('enex_pendiente','solicitudes_actualizacion') then
   if owner is null or owner not in (target.id::text,target.usuario,target.correo) then continue;end if;
  elsif setting->>'works'='assigned' and (nullif(work,'') is null or not exists(select 1 from unnest(string_to_array(coalesce(target.obras,''),',')) w where lower(trim(w)) in ('todas',lower(trim(work))))) then continue;end if;
  if setting->>'forms'='selected' and not coalesce(setting->'form_ids' ? (data->>'formulario_id'),false) then continue;end if;
  if setting->>'equipment'='selected' and not coalesce(setting->'equipment_ids' ? (data->>'equipo_id'),false) then continue;end if;
  channels:=jsonb_build_object('email',setting->'email','mobile',setting->'mobile','web',setting->'web');
  safe_payload:=jsonb_strip_nulls(jsonb_build_object('obra_id',data->'obra_id','reporte_id',data->'reporte_id','reporte_ids',data->'reporte_ids','respuesta_id',data->'respuesta_id','registro_id',data->'registro_id','solicitud_id',data->'solicitud_id','sesion_id',data->'sesion_id','fecha',data->'fecha')) || jsonb_build_object('event_id',event_key,'role_notification',true,'role_id',target.role_id,'role_name',target.rol,'channels',channels,'push_enabled',setting->'mobile','works_scope',setting->>'works','formulario_id',data->'formulario_id','equipo_id',data->'equipo_id','destination',data->'destination','detalle','Tienes un nuevo aviso. Consulta el registro con tus permisos habituales.');
  foreach channel in array array['Plataforma','Correo'] loop
   if channel='Correo' and (not coalesce((setting->>'email')::boolean,false) or nullif(target.correo,'') is null) then continue;end if;
   if channel='Plataforma' and not (coalesce((setting->>'web')::boolean,false) or coalesce((setting->>'mobile')::boolean,false)) then continue;end if;
   insert into public.notificaciones_entregas(empresa,evento_codigo,obra_nombre,canal,destinatario,asunto,estado,payload,enviada_at,role_route_key)
   values(company,code,work,channel,case when channel='Correo' then target.correo else target.id::text end,title,case when channel='Correo' then 'Pendiente' else 'Enviada' end,safe_payload,case when channel='Plataforma' then now() end,md5(company||':'||code||':'||event_key||':'||target.id||':'||channel))
   on conflict(role_route_key) where role_route_key is not null do nothing;
  end loop;
 end loop;
end $$;
