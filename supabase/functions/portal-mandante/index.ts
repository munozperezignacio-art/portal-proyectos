import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value.trim().toUpperCase())))).map(b=>b.toString(16).padStart(2,"0")).join("");
const TYPES=["Avance","Programacion","Hito","Estado de pago","RDI","Libro de obra","Calidad","Prevencion","Documento","Acreditacion"];
const ALLOWED_MIME=["application/pdf","image/jpeg","image/png","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const safeName=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120);

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método no permitido."},405);
  try{
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const body=await req.json(), token=String(body?.token||"").trim(), clave=String(body?.clave||"").trim();
    if(!token||!clave)return json({error:"Ingresa enlace y clave."},400);
    const {data:contract}=await db.from("mandante_contratos").select("id,proyecto_id,empresa_mandante,codigo,nombre,rut_contratista,empresa_contratista,contacto_nombre,contacto_email,paquetes,estado,fecha_inicio,fecha_termino,presupuesto_contractual,clave_externa_hash").eq("token_externo",token).eq("modalidad","Portal externo").maybeSingle();
    if(!contract||!contract.clave_externa_hash||await hash(clave)!==contract.clave_externa_hash)return json({error:"Enlace o clave incorrectos."},401);
    if(["Suspendido","Terminado","Archivado"].includes(contract.estado))return json({error:"El acceso contractual no se encuentra activo."},403);
    if(body.action==="create-upload"){
      const file=body?.file||{}, name=String(file.name||"").trim(), mime=String(file.type||""), size=Number(file.size||0);
      if(!name||!ALLOWED_MIME.includes(mime)||size<=0||size>20971520)return json({error:"Archivo no permitido. Usa PDF, imagen, Excel o Word de hasta 20 MB."},400);
      const templateId=String(body?.plantilla_id||"");
      const {data:uploadTemplate}=await db.from("mandante_plantillas_entrega").select("id,formatos_permitidos,max_archivos").eq("id",templateId).eq("contrato_id",contract.id).eq("activa",true).maybeSingle();
      if(!uploadTemplate)return json({error:"La plantilla de carga no es válida."},400);
      const extension=name.split(".").pop()?.toLowerCase()||"";
      if(!uploadTemplate.formatos_permitidos?.includes(extension))return json({error:`Formato .${extension||"desconocido"} no permitido para esta plantilla.`},400);
      const oneHourAgo=new Date(Date.now()-3600000).toISOString();
      const {count:pendingCount}=await db.from("mandante_adjuntos").select("id",{count:"exact",head:true}).eq("contrato_id",contract.id).eq("estado","Pendiente").gte("created_at",oneHourAgo);
      if(Number(pendingCount||0)>=20)return json({error:"Se alcanzó el límite temporal de archivos. Espera una hora o completa la entrega pendiente."},429);
      const path=`${contract.id}/${crypto.randomUUID()}-${safeName(name)}`;
      const {data:signed,error:signedError}=await db.storage.from("mandante-contractual").createSignedUploadUrl(path);
      if(signedError)throw signedError;
      const {data:attachment,error:attachmentError}=await db.from("mandante_adjuntos").insert({contrato_id:contract.id,empresa_mandante:contract.empresa_mandante,storage_path:path,nombre_archivo:name,mime_type:mime,tamano_bytes:size,subido_por:contract.contacto_nombre||contract.empresa_contratista}).select("id,nombre_archivo").single();
      if(attachmentError)throw attachmentError;
      return json({attachment,...signed,path});
    }
    if(body.action==="respond"){
      const deliveryId=String(body?.entrega_id||""), response=String(body?.respuesta||"").trim();
      if(response.length<3)return json({error:"Indica la respuesta a la observación."},400);
      const {data:previous}=await db.from("mandante_entregas").select("*").eq("id",deliveryId).eq("contrato_id",contract.id).maybeSingle();
      if(!previous||previous.estado!=="Observado")return json({error:"Esta entrega no está disponible para respuesta."},409);
      const root=previous.entrega_raiz_id||previous.id;
      const {data:last}=await db.from("mandante_entregas").select("version").eq("entrega_raiz_id",root).order("version",{ascending:false}).limit(1).maybeSingle();
      const {data:next,error:nextError}=await db.from("mandante_entregas").insert({contrato_id:contract.id,empresa_mandante:contract.empresa_mandante,empresa_origen:contract.empresa_contratista,tipo:previous.tipo,titulo:previous.titulo,periodo_desde:previous.periodo_desde,periodo_hasta:previous.periodo_hasta,fecha_compromiso:previous.fecha_compromiso,monto:previous.monto,datos:previous.datos,plantilla_id:previous.plantilla_id,partida_control_id:previous.partida_control_id,estado:"Reenviado",respuesta_contratista:response,enviado_por:contract.contacto_nombre||contract.empresa_contratista,respondido_por:contract.contacto_nombre||contract.empresa_contratista,respondido_at:new Date().toISOString(),version:Number(last?.version||previous.version||1)+1,entrega_raiz_id:root,entrega_anterior_id:previous.id}).select("id,version,estado").single();
      if(nextError)throw nextError;
      await db.from("mandante_eventos").insert({empresa_mandante:contract.empresa_mandante,proyecto_id:contract.proyecto_id,contrato_id:contract.id,accion:"Entrega respondida y reenviada",estado_resultante:"Reenviado",actor_nombre:contract.contacto_nombre,actor_empresa:contract.empresa_contratista,detalle:`${previous.tipo} · ${previous.titulo} · v${next.version}`});
      return json({success:true,entrega:next});
    }
    if(body.action==="submit"){
      const type=String(body?.entrega?.tipo||""); if(!TYPES.includes(type))return json({error:"Tipo de entrega inválido."},400);
      const packageKey:{[key:string]:string}={Avance:"avance",Programacion:"programacion",Hito:"hitos","Estado de pago":"estados_pago",RDI:"rdi","Libro de obra":"libro_obra",Calidad:"calidad",Prevencion:"prevencion",Documento:"documentos",Acreditacion:"acreditaciones"};
      if(contract.paquetes?.[packageKey[type]]!==true)return json({error:"Esta entrega no está habilitada en el contrato."},403);
      const templateId=String(body?.entrega?.plantilla_id||"");
      const {data:template}=await db.from("mandante_plantillas_entrega").select("id,apartado,nombre,campos,documento_obligatorio,max_archivos,activa").eq("id",templateId).eq("contrato_id",contract.id).eq("activa",true).maybeSingle();
      if(!template||template.apartado!==type)return json({error:"Selecciona una plantilla vigente para este apartado."},400);
      const attachmentIds=Array.isArray(body.entrega?.adjunto_ids)?body.entrega.adjunto_ids.slice(0,10):[];
      if(template.documento_obligatorio&&!attachmentIds.length)return json({error:"Esta plantilla exige adjuntar al menos un documento."},400);
      if(attachmentIds.length>Number(template.max_archivos||0))return json({error:`Esta plantilla permite hasta ${template.max_archivos} archivo(s).`},400);
      const values=body?.entrega?.datos&&typeof body.entrega.datos==="object"?body.entrega.datos:{};
      for(const field of Array.isArray(template.campos)?template.campos:[]){const value=values[String(field.key||"")];if(field.required&&(value===undefined||value===null||String(value).trim()===""))return json({error:`Completa el campo obligatorio: ${field.label||field.key}.`},400);}
      const partidaId=body?.entrega?.partida_control_id?String(body.entrega.partida_control_id):null;
      if(type==="Avance"){
        if(!partidaId)return json({error:"Selecciona la partida contractual asociada al avance."},400);
        const {data:partida}=await db.from("mandante_control_partidas").select("id,cantidad_contratada").eq("id",partidaId).eq("contrato_id",contract.id).eq("activa",true).maybeSingle();
        if(!partida)return json({error:"La partida seleccionada no pertenece a este contrato."},400);
        if(Number(values.cantidad_acumulada||0)>Number(partida.cantidad_contratada||0)*1.05)return json({error:"La cantidad acumulada supera la cantidad contractual."},400);
      }
      const title=String(body?.entrega?.titulo||template.nombre).trim();
      const {data,error}=await db.from("mandante_entregas").insert({contrato_id:contract.id,empresa_mandante:contract.empresa_mandante,empresa_origen:contract.empresa_contratista,tipo:type,titulo:title,periodo_desde:body.entrega.periodo_desde||null,periodo_hasta:body.entrega.periodo_hasta||null,monto:Number(body.entrega.monto||values.monto_presentado||0),datos:values,plantilla_id:template.id,partida_control_id:partidaId,estado:"Recibido",enviado_por:contract.contacto_nombre||contract.empresa_contratista}).select("id,tipo,titulo,estado,enviado_at").single();
      if(error)throw error;
      if(attachmentIds.length){
        const {error:attachError}=await db.from("mandante_adjuntos").update({entrega_id:data.id,estado:"Adjunto"}).eq("contrato_id",contract.id).eq("estado","Pendiente").in("id",attachmentIds);
        if(attachError)throw attachError;
      }
      await db.from("mandante_eventos").insert({empresa_mandante:contract.empresa_mandante,proyecto_id:contract.proyecto_id,contrato_id:contract.id,accion:`${type} recibido desde portal externo`,estado_resultante:"Recibido",actor_nombre:contract.contacto_nombre,actor_empresa:contract.empresa_contratista,detalle:title});
      return json({success:true,entrega:data});
    }
    const [{data:obligations},{data:accreditations},{data:deliveries},{data:templates},{data:controlItems}]=await Promise.all([
      db.from("mandante_obligaciones").select("id,tipo,nombre,periodicidad,proxima_fecha,responsable").eq("contrato_id",contract.id).eq("activa",true).order("proxima_fecha"),
      db.from("mandante_acreditaciones").select("id,categoria,estado,total_requeridos,total_recibidos,total_aprobados,proximo_vencimiento,observacion").eq("contrato_id",contract.id).order("categoria"),
      db.from("mandante_entregas").select("id,tipo,titulo,periodo_desde,periodo_hasta,monto,datos,plantilla_id,partida_control_id,estado,observacion_mandante,respuesta_contratista,enviado_at,revisado_at,version,entrega_raiz_id,entrega_anterior_id").eq("contrato_id",contract.id).order("enviado_at",{ascending:false}).limit(100),
      db.from("mandante_plantillas_entrega").select("id,apartado,nombre,instrucciones,campos,formatos_permitidos,max_archivos,documento_obligatorio,orden").eq("contrato_id",contract.id).eq("activa",true).order("orden"),
      db.from("mandante_control_partidas").select("id,codigo,partida,unidad,cantidad_contratada,precio_unitario,moneda,fecha_inicio,fecha_termino,ponderacion_pct,orden").eq("contrato_id",contract.id).eq("activa",true).order("orden")
    ]);
    const deliveryIds=(deliveries||[]).map(item=>item.id);
    const {data:attachmentRows}=deliveryIds.length?await db.from("mandante_adjuntos").select("id,entrega_id,nombre_archivo,mime_type,tamano_bytes,storage_path").in("entrega_id",deliveryIds).eq("estado","Adjunto"):{data:[]};
    const attachments=await Promise.all((attachmentRows||[]).map(async item=>{const {data:signed}=await db.storage.from("mandante-contractual").createSignedUrl(item.storage_path,600);const {storage_path,...safeAttachment}=item;return {...safeAttachment,url:signed?.signedUrl||null};}));
    await db.from("mandante_contratos").update({ultimo_acceso_externo:new Date().toISOString()}).eq("id",contract.id);
    await db.from("mandante_eventos").insert({empresa_mandante:contract.empresa_mandante,proyecto_id:contract.proyecto_id,contrato_id:contract.id,accion:"Acceso al portal contractual",actor_nombre:contract.contacto_nombre,actor_empresa:contract.empresa_contratista});
    const {clave_externa_hash,...safe}=contract;
    const {data:actions}=deliveryIds.length?await db.from("mandante_entrega_acciones").select("id,entrega_id,accion,estado_resultante,comentario,actor_nombre,actor_empresa,actor_tipo,created_at").in("entrega_id",deliveryIds).order("created_at"):{data:[]};
    return json({contract:safe,obligations:obligations||[],accreditations:accreditations||[],deliveries:deliveries||[],templates:templates||[],controlItems:controlItems||[],attachments,actions:actions||[]});
  }catch(error){return json({error:error instanceof Error?error.message:String(error)},500);}
});
