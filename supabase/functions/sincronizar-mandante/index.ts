import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const text=(value:unknown)=>String(value??"").trim();
const digest=async(value:unknown)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value))))).map(x=>x.toString(16).padStart(2,"0")).join("");

type SourceSpec={packageId:string;module:string;table:string;type:string;select:string;dateField:string;updatedField?:string;build:(row:Record<string,unknown>)=>{title:string;amount?:number;summary:Record<string,unknown>}};
const specs:SourceSpec[]=[
  {packageId:"avance",module:"Avance",table:"avances_produccion_partidas",type:"Avance",select:"id,created_at,obra_nombre,supervisor,frente,partida,unidad,cantidad,observaciones,obra_id,empresa",dateField:"created_at",build:r=>({title:`Avance · ${text(r.partida)||`registro ${r.id}`}`,summary:{partida:r.partida,frente:r.frente,cantidad:r.cantidad,unidad:r.unidad,supervisor:r.supervisor,fecha:r.created_at,observaciones:r.observaciones}})},
  {packageId:"estados_pago",module:"Estados de pago",table:"estados_pago_obra",type:"Estado de pago",select:"id,empresa,obra_nombre,numero,fecha_corte,monto_bruto,monto_neto,retencion_monto,anticipo_descontado,estado,created_at,updated_at,factura_numero,factura_estado",dateField:"fecha_corte",updatedField:"updated_at",build:r=>({title:`Estado de Pago N° ${r.numero}`,amount:Number(r.monto_neto||0),summary:{numero:r.numero,fecha_corte:r.fecha_corte,monto_bruto:r.monto_bruto,monto_neto:r.monto_neto,retencion:r.retencion_monto,anticipo_descontado:r.anticipo_descontado,estado:r.estado,factura_numero:r.factura_numero,factura_estado:r.factura_estado}})},
  {packageId:"rdi",module:"RDI",table:"calidad_rdi",type:"RDI",select:"id,empresa,obra_nombre,partida,codigo,fecha_solicitud,sector,cantidad,unidad,solicitado_por,inspector,fecha_inspeccion,estado,observaciones,created_at,updated_at",dateField:"fecha_solicitud",updatedField:"updated_at",build:r=>({title:`RDI ${text(r.codigo)||r.id} · ${text(r.partida)}`,summary:{codigo:r.codigo,partida:r.partida,fecha_solicitud:r.fecha_solicitud,sector:r.sector,cantidad:r.cantidad,unidad:r.unidad,solicitado_por:r.solicitado_por,inspector:r.inspector,fecha_inspeccion:r.fecha_inspeccion,estado:r.estado,observaciones:r.observaciones}})},
  {packageId:"calidad",module:"Calidad",table:"calidad_recepciones_partidas",type:"Calidad",select:"id,empresa,obra_nombre,codigo,partida,fecha_entrega,cantidad,unidad,sector,entrega_por,recibe_por,estado,observaciones,created_at,updated_at",dateField:"fecha_entrega",updatedField:"updated_at",build:r=>({title:`Recepción ${text(r.codigo)||r.id} · ${text(r.partida)}`,summary:{clase:"Recepción de partida",codigo:r.codigo,partida:r.partida,fecha_entrega:r.fecha_entrega,cantidad:r.cantidad,unidad:r.unidad,sector:r.sector,entrega_por:r.entrega_por,recibe_por:r.recibe_por,estado:r.estado,observaciones:r.observaciones}})},
  {packageId:"calidad",module:"Calidad",table:"calidad_no_conformidades",type:"Calidad",select:"id,empresa,obra_nombre,partida,codigo,descripcion,clasificacion,estado,responsable,fecha_compromiso,fecha_cierre,created_at,updated_at,impacto",dateField:"created_at",updatedField:"updated_at",build:r=>({title:`NC ${text(r.codigo)||r.id} · ${text(r.partida)}`,summary:{clase:"No conformidad",codigo:r.codigo,partida:r.partida,descripcion:r.descripcion,clasificacion:r.clasificacion,impacto:r.impacto,estado:r.estado,responsable:r.responsable,fecha_compromiso:r.fecha_compromiso,fecha_cierre:r.fecha_cierre}})},
  {packageId:"libro_obra",module:"Libro de obra",table:"libro_obra_digital",type:"Libro de obra",select:"id,empresa,obra_nombre,folio,fecha,tipo,asunto,emisor,destinatario,partida,estado,flujo_estado,created_at,updated_at",dateField:"fecha",updatedField:"updated_at",build:r=>({title:`Folio ${text(r.folio)||r.id} · ${text(r.asunto)}`,summary:{folio:r.folio,fecha:r.fecha,tipo:r.tipo,asunto:r.asunto,emisor:r.emisor,destinatario:r.destinatario,partida:r.partida,estado:r.estado,flujo_estado:r.flujo_estado}})},
  {packageId:"prevencion",module:"Prevención",table:"prevencion_respuestas",type:"Prevencion",select:"id,formulario_id,proyecto_nombre,inspector,created_at,centro_gestion_id,obra_id",dateField:"created_at",build:r=>({title:`Registro preventivo #${r.id}`,summary:{formulario_id:r.formulario_id,inspector:r.inspector,fecha:r.created_at,centro_gestion_id:r.centro_gestion_id}})},
];

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Método no permitido."},405);
  try{
    const authHeader=req.headers.get("Authorization")||"";
    const auth=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
    const {data:{user},error:userError}=await auth.auth.getUser();
    if(userError||!user)return reply({error:"Sesión no válida."},401);
    const body=await req.json(); const contractId=text(body?.contrato_id);
    if(!contractId)return reply({error:"Contrato requerido."},400);
    const {data:profile}=await auth.from("usuarios").select("empresa,nombre,usuario").eq("auth_user_id",user.id).maybeSingle();
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const {data:contract,error:contractError}=await db.from("mandante_contratos").select("*").eq("id",contractId).maybeSingle();
    if(contractError||!contract)return reply({error:"Contrato no encontrado."},404);
    if(!profile?.empresa||![contract.empresa_mandante,contract.empresa_obraxis_vinculada].includes(profile.empresa))return reply({error:"No tienes acceso a este contrato."},403);
    if(contract.modalidad!=="Empresa Obraxis"||!contract.empresa_obraxis_vinculada||!contract.obra_contratista_id)return reply({error:"El contrato no está enlazado a una obra de otra empresa Obraxis."},409);
    let created=0,skipped=0; const errors:string[]=[]; const counts:Record<string,number>={};
    for(const spec of specs){
      if(contract.paquetes?.[spec.packageId]!==true)continue;
      let query=db.from(spec.table).select(spec.select);
      if(spec.table==="prevencion_respuestas")query=query.eq("obra_id",contract.obra_contratista_id);
      else query=query.eq("empresa",contract.empresa_obraxis_vinculada).eq("obra_nombre",contract.obra_contratista_nombre);
      const {data:rows,error:sourceError}=await query.limit(500);
      if(sourceError){errors.push(`${spec.module}: ${sourceError.message}`);continue;}
      for(const raw of rows||[]){
        const row=raw as Record<string,unknown>; const built=spec.build(row);
        const fingerprint=await digest(built.summary);
        const {data:existing}=await db.from("mandante_integraciones").select("id").eq("contrato_id",contract.id).eq("fuente_tabla",spec.table).eq("fuente_id",text(row.id)).eq("huella",fingerprint).maybeSingle();
        if(existing){skipped++;continue;}
        const {data:history}=await db.from("mandante_integraciones").select("entrega_id,mandante_entregas!inner(id,version,entrega_raiz_id)").eq("contrato_id",contract.id).eq("fuente_tabla",spec.table).eq("fuente_id",text(row.id)).order("created_at",{ascending:false}).limit(1);
        const previous:any=history?.[0]?.mandante_entregas; const rootId=previous?.entrega_raiz_id||previous?.id||null;
        const sourceDate=text(row[spec.dateField])||new Date().toISOString(); const isoDate=sourceDate.slice(0,10);
        const {data:delivery,error:deliveryError}=await db.from("mandante_entregas").insert({contrato_id:contract.id,empresa_mandante:contract.empresa_mandante,empresa_origen:contract.empresa_obraxis_vinculada,tipo:spec.type,titulo:built.title,periodo_desde:isoDate,periodo_hasta:isoDate,monto:built.amount||0,datos:{...built.summary,origen_automatico:true,fuente:{tabla:spec.table,id:text(row.id),huella:fingerprint}},estado:previous?"Reenviado":"Recibido",enviado_por:profile.nombre||profile.usuario||"Sincronización Obraxis",version:Number(previous?.version||0)+1,entrega_raiz_id:rootId,entrega_anterior_id:previous?.id||null}).select("id").single();
        if(deliveryError){errors.push(`${spec.module} #${row.id}: ${deliveryError.message}`);continue;}
        const updated=text(spec.updatedField?row[spec.updatedField]:row[spec.dateField])||null;
        const {error:linkError}=await db.from("mandante_integraciones").insert({contrato_id:contract.id,entrega_id:delivery.id,empresa_mandante:contract.empresa_mandante,empresa_origen:contract.empresa_obraxis_vinculada,modulo:spec.module,fuente_tabla:spec.table,fuente_id:text(row.id),huella:fingerprint,fuente_actualizada_at:updated,resumen:built.summary,sincronizado_por:profile.nombre||profile.usuario||user.email});
        if(linkError){await db.from("mandante_entregas").delete().eq("id",delivery.id);errors.push(`${spec.module} #${row.id}: ${linkError.message}`);continue;}
        created++;counts[spec.module]=(counts[spec.module]||0)+1;
      }
    }
    await db.from("mandante_eventos").insert({empresa_mandante:contract.empresa_mandante,proyecto_id:contract.proyecto_id,contrato_id:contract.id,accion:"Sincronización contractual Obraxis",estado_resultante:errors.length?"Con observaciones":"Completada",actor_nombre:profile.nombre||profile.usuario,actor_empresa:profile.empresa,detalle:`${created} nuevos; ${skipped} sin cambios; ${errors.length} observaciones`});
    return reply({success:true,created,skipped,counts,errors});
  }catch(error){return reply({error:error instanceof Error?error.message:String(error)},500);}
});
