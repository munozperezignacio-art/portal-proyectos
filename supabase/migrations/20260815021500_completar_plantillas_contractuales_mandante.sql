-- Completa los diez apartados contractuales y corrige el mapeo de paquetes.
create or replace function private.inicializar_plantillas_mandante()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare item record;
begin
  for item in select * from (values
    ('Avance','avance','Avance físico por partida','Selecciona una partida de la línea base e informa cantidades ejecutadas.','[{"key":"cantidad_periodo","label":"Cantidad ejecutada en el período","type":"number","required":true},{"key":"cantidad_acumulada","label":"Cantidad acumulada","type":"number","required":true},{"key":"fecha_medicion","label":"Fecha de medición","type":"date","required":true}]'::jsonb,false),
    ('Programacion','programacion','Actualización de programación','Informa desviaciones y adjunta el programa actualizado.','[{"key":"fecha_estado","label":"Fecha de estado","type":"date","required":true},{"key":"causa_desviacion","label":"Causa de desviación","type":"textarea","required":false},{"key":"medida_recuperacion","label":"Medida de recuperación","type":"textarea","required":false}]'::jsonb,true),
    ('Hito','hitos','Cumplimiento de hito contractual','Informa el cumplimiento o reprogramación del hito.','[{"key":"hito","label":"Hito contractual","type":"text","required":true},{"key":"fecha_comprometida","label":"Fecha comprometida","type":"date","required":true},{"key":"fecha_real","label":"Fecha real o proyectada","type":"date","required":true},{"key":"estado_hito","label":"Estado","type":"select","required":true,"options":["Cumplido","En riesgo","Reprogramado"]}]'::jsonb,false),
    ('Estado de pago','estados_pago','Estado de pago contractual','Registra el período, monto presentado y adjunta el documento.','[{"key":"numero_ep","label":"Número de estado de pago","type":"number","required":true},{"key":"fecha_presentacion","label":"Fecha de presentación","type":"date","required":true},{"key":"monto_presentado","label":"Monto presentado","type":"money","required":true}]'::jsonb,true),
    ('RDI','rdi','Solicitud o respuesta RDI','Identifica la consulta técnica y adjunta sus antecedentes.','[{"key":"codigo_rdi","label":"Código RDI","type":"text","required":true},{"key":"especialidad","label":"Especialidad","type":"text","required":true},{"key":"fecha_emision","label":"Fecha de emisión","type":"date","required":true},{"key":"consulta","label":"Consulta o respuesta","type":"textarea","required":true}]'::jsonb,true),
    ('Libro de obra','libro_obra','Anotación de Libro de Obra','Entrega el folio emitido y su respaldo.','[{"key":"folio","label":"Folio","type":"text","required":true},{"key":"fecha_anotacion","label":"Fecha","type":"date","required":true},{"key":"asunto","label":"Asunto","type":"text","required":true}]'::jsonb,true),
    ('Calidad','calidad','Registro de calidad','Entrega protocolos, recepciones, certificados o no conformidades.','[{"key":"tipo_registro","label":"Tipo de registro","type":"text","required":true},{"key":"fecha_registro","label":"Fecha","type":"date","required":true},{"key":"resultado","label":"Resultado","type":"text","required":true}]'::jsonb,true),
    ('Prevencion','prevencion','Registro de prevención','Entrega registros preventivos, incidentes o indicadores.','[{"key":"tipo_registro","label":"Tipo de registro","type":"text","required":true},{"key":"fecha_registro","label":"Fecha","type":"date","required":true},{"key":"observacion","label":"Observación","type":"textarea","required":false}]'::jsonb,true),
    ('Documento','documentos','Documentación contractual','Carga el documento solicitado e identifica su vigencia.','[{"key":"tipo_documento","label":"Tipo de documento","type":"text","required":true},{"key":"fecha_documento","label":"Fecha del documento","type":"date","required":true},{"key":"vigencia_hasta","label":"Vigencia hasta","type":"date","required":false}]'::jsonb,true),
    ('Acreditacion','acreditaciones','Expediente de acreditación','Carga antecedentes de empresa, personal o equipos.','[{"key":"categoria","label":"Categoría","type":"select","required":true,"options":["Empresa","Personal","Equipos"]},{"key":"vigencia_hasta","label":"Vigencia hasta","type":"date","required":false}]'::jsonb,true)
  ) as v(apartado,paquete,nombre,instrucciones,campos,documento_obligatorio)
  loop
    if coalesce((new.paquetes ->> item.paquete)::boolean,false) then
      insert into public.mandante_plantillas_entrega(contrato_id,empresa_mandante,apartado,nombre,instrucciones,campos,documento_obligatorio)
      values(new.id,new.empresa_mandante,item.apartado,item.nombre,item.instrucciones,item.campos,item.documento_obligatorio)
      on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;

insert into public.mandante_plantillas_entrega(contrato_id,empresa_mandante,apartado,nombre,instrucciones,campos,documento_obligatorio)
select c.id,c.empresa_mandante,v.apartado,v.nombre,v.instrucciones,v.campos,v.documento_obligatorio
from public.mandante_contratos c
cross join (values
 ('Hito','hitos','Cumplimiento de hito contractual','Informa el cumplimiento o reprogramación del hito.','[{"key":"hito","label":"Hito contractual","type":"text","required":true},{"key":"fecha_comprometida","label":"Fecha comprometida","type":"date","required":true},{"key":"fecha_real","label":"Fecha real o proyectada","type":"date","required":true},{"key":"estado_hito","label":"Estado","type":"select","required":true,"options":["Cumplido","En riesgo","Reprogramado"]}]'::jsonb,false),
 ('RDI','rdi','Solicitud o respuesta RDI','Identifica la consulta técnica y adjunta sus antecedentes.','[{"key":"codigo_rdi","label":"Código RDI","type":"text","required":true},{"key":"especialidad","label":"Especialidad","type":"text","required":true},{"key":"fecha_emision","label":"Fecha de emisión","type":"date","required":true},{"key":"consulta","label":"Consulta o respuesta","type":"textarea","required":true}]'::jsonb,true),
 ('Libro de obra','libro_obra','Anotación de Libro de Obra','Entrega el folio emitido y su respaldo.','[{"key":"folio","label":"Folio","type":"text","required":true},{"key":"fecha_anotacion","label":"Fecha","type":"date","required":true},{"key":"asunto","label":"Asunto","type":"text","required":true}]'::jsonb,true)
) as v(apartado,paquete,nombre,instrucciones,campos,documento_obligatorio)
where coalesce((c.paquetes ->> v.paquete)::boolean,false)
on conflict do nothing;
