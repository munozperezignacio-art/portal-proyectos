import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { workCatalog, responsibleCatalog, removeHiddenAnswers, validateFormAnswers } from "../_shared/formFields.mjs";
import { normalizeRut, checklistCandidates } from '../_shared/equipmentQr.mjs';

const cors={"Access-Control-Allow-Origin":"https://www.obraxis.cl","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const clean=(v:unknown,max=250)=>String(v??"").trim().slice(0,max);
const digest=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,"0")).join("");

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return json({error:"Método no permitido"},405);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key)return json({error:"Servicio no configurado"},500);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const body=await req.json();
    const action=clean(body?.action,20),token=clean(body?.token,160);
    if(token.length<8)return json({error:"Enlace inválido"},404);
    const ip=clean(req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown",80);
    const [tokenHash,ipHash]=await Promise.all([digest(token),digest(ip)]);
    const since=new Date(Date.now()-15*60*1000).toISOString();
    const {count}=await db.from("formulario_publico_intentos").select("id",{count:"exact",head:true}).eq("token_hash",tokenHash).eq("ip_hash",ipHash).eq("accion",action).gte("created_at",since);
    const limit=action==="enviar"?12:80;
    if((count||0)>=limit)return json({error:"Demasiados intentos. Intenta nuevamente más tarde."},429);
    const log=async(exitoso:boolean)=>{await db.from("formulario_publico_intentos").insert({token_hash:tokenHash,ip_hash:ipHash,accion:action,exitoso});};
    const {data:form,error:formError}=await db.from("prevencion_formularios").select("id,titulo,descripcion,categoria,campos,publico_token,codigo,revision,fecha_revision,empresa,cargos_obligados").eq("publico_token",token).maybeSingle();
    if(formError||!form){await log(false);return json({error:"Formulario no disponible"},404);}
    let qrEquipment:any=null,qrActor:any=null,qrWork:any=null,qrDate='';
    if(body.qrContext){
      const qrToken=clean(body.qrContext.token,100),rut=normalizeRut(body.qrContext.rut);
      if(!/^[a-f0-9]{48}$/.test(qrToken)||!rut)return json({error:'Identificación QR inválida'},403);
      const eq=await db.from('inventario_maquinaria').select('id,empresa,tipo,patente,marca,obra_nombre,horometro_inicial').eq('publico_token',qrToken).eq('empresa',form.empresa).maybeSingle();
      if(eq.error||!eq.data||!checklistCandidates(eq.data,[form]).includes(form.id))return json({error:'El formulario no corresponde al equipo del QR'},403);
      const config=await db.from('maquinaria_reporte_equipo').select('qr_activo').eq('equipo_id',eq.data.id).maybeSingle();
      if(config.error||config.data?.qr_activo===false)return json({error:'QR no disponible'},403);
      const person=await db.rpc('equipo_qr_persona',{p_empresa:form.empresa,p_rut:rut});
      if(person.error||person.data?.length!==1)return json({error:'RUT no disponible en el personal activo'},403);
      qrEquipment=eq.data;qrActor={...person.data[0],rut};
      qrDate=clean(body.qrContext.fecha,10)||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago'}).format(new Date());
      const selectedWork=await db.rpc('equipo_obra_registro',{p_equipo:eq.data.id,p_fecha:qrDate,p_obra:Number(body.qrContext.obra_id)||null});
      if(selectedWork.error)return json({error:'Revisa la obra asignada al equipo para la fecha del checklist.'},409);
      qrWork=selectedWork.data;
      qrEquipment.obra_nombre=qrWork?.nombre||'';
    }
    if(form.campos?.control_documental?.equipo_checklist_id&&!qrEquipment)return json({error:'Abre este checklist desde el QR del equipo para identificarte.'},403);
    const fields=Array.isArray(form.campos)?form.campos:(form.campos?.items||[]);
    const coreAnswers=qrEquipment?{qr_equipo:[qrEquipment.tipo,qrEquipment.patente].filter(Boolean).join(' · '),qr_rut:qrActor.rut,qr_nombre:qrActor.nombre,qr_cargo:qrActor.cargo||'Sin cargo informado',qr_fecha:qrDate}:{};
    const usage=form.campos?.control_documental?.tipo_registro==="maquinaria_uso";
    const usageField={source:"machinery",selectorKey:"patente",autofillKeys:["marca","tipo","horometro_inicial"]};
    const catalogFor=async(field:any,centers:any[])=>{
      if(field.source==="machinery"){
        const results:any[]=[];
        const control=form.campos?.control_documental||{};
        const restricted=control.todas_las_obras!==true && Array.isArray(control.centros_gestion_ids) && control.centros_gestion_ids.length>0;
        const norm=(s:any)=>String(s||"").trim().toLowerCase();
        for(let offset=0;;offset+=500){
          const {data,error}=await db.from("inventario_maquinaria").select("id,tipo,patente,obra_nombre,marca,estado_equipo,horometro_inicial").eq("empresa",form.empresa).order("id").range(offset,offset+499);
          if(error)throw error;
          for(const eq of data||[]){
            const work=qrEquipment&&String(eq.id)===String(qrEquipment.id)?centers.find(c=>Number(c.obra_id)===Number(qrWork?.id)):centers.find(c=>c.obra_id && norm(c.obra_nombre)===norm(eq.obra_nombre));
            if(restricted&&!work)continue;
            const display=[eq.tipo,eq.patente].filter(Boolean).join(" · ")||"Equipo "+eq.id;
            const safe:any={equipo:display,tipo:eq.tipo,marca:eq.marca,patente:eq.patente,estado_equipo:eq.estado_equipo,horometro_inicial:eq.horometro_inicial};
            results.push({_id:String(eq.id),_display:display,obra_id:work?.obra_id||null,...Object.fromEntries([field.selectorKey,...(field.autofillKeys||[])].filter(k=>Object.hasOwn(safe,k)).map(k=>[k,safe[k]]))});
          }
          if(!data||data.length<500)return results;
        }
      }
      if(field.source==="responsibles"){
        if(!Array.isArray(field.cargos)||!field.cargos.length)return [];
        const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago"}).format(new Date());
        const readAll=async(table:string,columns:string)=>{
          const rows:any[]=[];
          for(let offset=0;;offset+=1000){
            const {data,error}=await db.from(table).select(columns).eq("empresa",form.empresa).order("id").range(offset,offset+999);
            if(error)throw error;
            rows.push(...(data||[]));if(!data||data.length<1000)return rows;
          }
        };
        const [people,assignments]=await Promise.all([
          readAll("maestro_personal","id,nombre,cargo,centro_gestion_id,obra_nombre,fecha_asig,fecha_inicio_contrato,fecha_vencimiento_contrato"),
          readAll("rrhh_personal_centros","id,trabajador_id,centro_gestion_id,fecha_inicio,fecha_termino")
        ]);
        return responsibleCatalog(field,people,assignments,centers,today);
      }
      if(field.source==="works"){
        const ids=centers.map((center:any)=>center.id);
        if(!ids.length)return [];
        const {data,error}=await db.from("obras").select("id,nombre,centro_gestion_id,admin_contrato,ubicacion,oficina_tecnica,cliente,prevencionista,tipo").eq("empresa",form.empresa).in("centro_gestion_id",ids).order("nombre");
        if(error)throw error;
        return workCatalog(field,data||[]);
      }
      const {data,error}=await db.rpc("formulario_catalogo_vinculado",{p_token:token,p_campo_id:String(field.id)});
      if(error)throw error;
      return Array.isArray(data)?data:[];
    };

    if(action==="personal_centro"){
      if(form.campos?.control_documental?.personal_por_centro!==true)return json({error:"Acción no habilitada"},400);
      const {data:centers,error}=await db.rpc("formulario_centros_gestion",{p_token:token});
      if(error)throw error;
      const center=(centers||[]).find((c:any)=>Number(c.id)===Number(body.centro_gestion_id));
      if(!center){await log(false);return json({error:"Centro no autorizado"},403);}
      const entries=await Promise.all(fields.filter((f:any)=>f.type==="data_lookup"&&f.source==="responsibles").map(async(f:any)=>[String(f.id),await catalogFor(f,[center])]));
      await log(true);return json({catalogos:Object.fromEntries(entries)});
    }
    if(action==="cargar"){
      const {data:branding}=await db.from("config_empresa").select("logo_base64,color_primario,color_secundario").eq("empresa",form.empresa).maybeSingle();
      const {data:centers,error:centerError}=await db.rpc("formulario_centros_gestion",{p_token:token});
      if(centerError)throw centerError;
      const storedFields:any=form.campos;
      const fields=Array.isArray(storedFields)?storedFields:(storedFields?.items||[]);
      const linkedFields=fields.filter((field:any)=>field?.type==="data_lookup"&&field?.id&&!(storedFields?.control_documental?.personal_por_centro===true&&field.source==="responsibles"));
      const catalogEntries=await Promise.all(linkedFields.map(async(field:any)=>{
        return[String(field.id),await catalogFor(field,Array.isArray(centers)?centers:[])];
      }));
      if(usage)catalogEntries.push(["__usage_equipment",await catalogFor(usageField,centers||[])]);
      const initialAnswers:any={},initialMetadata:any={};
      if(qrEquipment){
        Object.assign(initialAnswers,Object.fromEntries(Object.entries(coreAnswers).filter(([id])=>fields.some((f:any)=>f.id===id))));
        if(fields.some((f:any)=>f.id==='qr_horometro'))initialAnswers.qr_horometro=qrEquipment.horometro_inicial??0;
        // Resolve the selected work from trusted assignments, never from editable answers.
        const center=(centers||[]).find((c:any)=>c.obra_nombre===qrEquipment.obra_nombre);
        Object.assign(initialMetadata,{proyecto_nombre:qrEquipment.obra_nombre||'',obra_id:qrWork?.id||'',centro_gestion_id:center?.id||'',inspector:qrActor.nombre});
        for(const f of fields){
          if(f.source==='machinery')initialAnswers[f.id]=(catalogEntries.find(([id]:any)=>id===String(f.id))?.[1]||[]).find((r:any)=>String(r._id)===String(qrEquipment.id));
          if(f.type==='text'&&/^obra(?:\s|$)/i.test(f.label))initialAnswers[f.id]=qrEquipment.obra_nombre||'Bodega / sin asignar';
          if(f.type==='text'&&/patente$/i.test(f.label))initialAnswers[f.id]=qrEquipment.patente;
          if(f.source==='works')initialAnswers[f.id]=(catalogEntries.find(([id]:any)=>id===String(f.id))?.[1]||[]).find((r:any)=>Number(r.obra_id)===Number(qrWork?.id));
        }
      }
      await log(true); return json({form,branding:branding||null,centros:Array.isArray(centers)?centers:[],catalogos:Object.fromEntries(catalogEntries),initialAnswers,initialMetadata});
    }
    if(action!=="enviar")return json({error:"Acción inválida"},400);
    const answers=body?.respuestas;
    if(!answers||typeof answers!=="object"||Array.isArray(answers))return json({error:"Respuestas inválidas"},400);
    if(qrEquipment){
      Object.assign(answers,Object.fromEntries(Object.entries(coreAnswers).filter(([id])=>fields.some((f:any)=>f.id===id))));
      if(fields.some((f:any)=>f.id==='qr_horometro')&&(!Number.isFinite(Number(answers.qr_horometro))||Number(answers.qr_horometro)<0))return json({error:'Ingresa un horómetro válido.'},400);
      body.obra_id=qrWork?.id||null;body.centro_gestion_id=qrWork?.centro_gestion_id||null;body.proyecto_nombre=qrWork?.nombre||null;
      for(const field of fields){
        if(field.source==='machinery'&&String(answers[field.id]?._id)!==String(qrEquipment.id))return json({error:'El checklist debe corresponder al equipo del QR.'},400);
        if(field.type==='text'&&/patente$/i.test(field.label))answers[field.id]=qrEquipment.patente;
        if(field.type==='text'&&/^obra(?:\s|$)/i.test(field.label))answers[field.id]=qrWork?.nombre||'Bodega / Sin asignar';
      }
      answers._qr_identidad={equipo_id:qrEquipment.id,patente:qrEquipment.patente,obra_id:qrWork?.id||null,obra_nombre:qrWork?.nombre||null,fecha:qrDate,rut:qrActor.rut,nombre:qrActor.nombre,cargo:qrActor.cargo,identidad:'declarada, RUT coincidente con personal'};
      answers._qr_formulario={id:form.id,titulo:form.titulo,campos:form.campos,codigo:form.codigo,revision:form.revision,fecha_revision:form.fecha_revision,empresa:form.empresa};
    }
    if(new TextEncoder().encode(JSON.stringify(answers)).length>10*1024*1024)return json({error:"El formulario supera el tamaño permitido"},413);
    const centerId=Number(body?.centro_gestion_id)||null,workId=Number(body?.obra_id)||null;
    let workName=clean(body?.proyecto_nombre,250)||null;
    const stored:any=form.campos,control=stored&&!Array.isArray(stored)?stored.control_documental||{}:{};
    const {data:authorizedCenters,error:scopeError}=await db.rpc("formulario_centros_gestion",{p_token:token});
    if(scopeError)throw scopeError;
    const centers=Array.isArray(authorizedCenters)?authorizedCenters:[];
    if((!qrEquipment&&!centerId&&workId)||(centerId&&!centers.some((center:any)=>Number(center.id)===centerId)))return json({error:"Centro de gestión no autorizado"},403);
    if(workId){const {data:work}=await db.from("obras").select("id,nombre,centro_gestion_id").eq("id",workId).eq("empresa",form.empresa).maybeSingle();if(!work||(Number(work.centro_gestion_id)||null)!==centerId)return json({error:"Obra no autorizada"},403);workName=work.nombre;}
    removeHiddenAnswers(fields,answers);
    const validationErrors=validateFormAnswers(fields,answers);
    if(validationErrors.length)return json({error:validationErrors.join("\n")},400);
    for(const field of fields.filter((field:any)=>field.type==="data_lookup")){
      const value=answers[field.id];
      if(!value)continue;
      if(value._id==="manual"&&!centerId&&!workId&&["works","responsibles"].includes(field.source)){
        const nombre=clean(value.nombre,field.source==="works"?250:200);
        if(!nombre)return json({error:`${field.label}: escribe un nombre.`},400);
        answers[field.id]={_id:"manual",_display:nombre,nombre};
        if(field.source==="works")workName=nombre;
        continue;
      }
      const catalog=await catalogFor(field,centers);
      const record=catalog.find((item:any)=>String(item._id)===String(value._id));
      if(!record||(field.source==="machinery"&&workId&&Number(record.obra_id)!==workId)||(record.centro_gestion_id&&Number(record.centro_gestion_id)!==centerId)||(field.source==="works"&&Number(record.obra_id)!==workId))return json({error:`${field.label}: registro no autorizado para esta obra.`},403);
      const keys=field.source==="works"?["nombre",...(field.autofillKeys||[])]:[field.selectorKey,...(field.autofillKeys||[])];
      answers[field.id]={_id:record._id,_display:record._display,...Object.fromEntries(keys.filter((key:string)=>Object.hasOwn(record,key)&&!key.startsWith("_")).map((key:string)=>[key,record[key]]))};
    }
    const responsibleField=fields.find((field:any)=>field.type==="data_lookup"&&field.source==="responsibles");
    const inspector=qrActor?`${qrActor.nombre} · ${qrActor.cargo||''}`:clean(responsibleField?answers[responsibleField.id]?.nombre:body?.inspector,200)||"Trabajador Terreno",signature=clean(body?.firma_url,4*1024*1024)||null;
    if(usage){
      const selected=answers.equipo_patente;
      const equipment=(await catalogFor(usageField,centers)).find((r:any)=>r.patente && String(r.patente).toUpperCase()===String(selected?.patente||selected).toUpperCase() && (!workId||Number(r.obra_id)===workId));
      if(!equipment)return json({error:"Selecciona un equipo del inventario autorizado."},400);
    }
    const {data:saved,error:saveError}=await db.from("prevencion_respuestas").insert({formulario_id:form.id,centro_gestion_id:centerId,obra_id:workId,proyecto_nombre:workName,inspector,respuestas:answers,firma_url:signature}).select("id").single();
    if(saveError){await log(false);throw saveError;}
    if(control.tipo_registro==="maquinaria_uso"){
      const patent=clean(((answers as any).equipo_patente?.patente || (answers as any).equipo_patente),40).toUpperCase();
      const initial=Number((answers as any).horometro_inicial),final=Number((answers as any).horometro_final);
      const{data:equipment}=await db.from("inventario_maquinaria").select("id,tipo,patente,obra_nombre,horometro_inicial,empresa").eq("empresa",form.empresa).ilike("patente",patent).maybeSingle();
      if(!equipment||!Number.isFinite(initial)||!Number.isFinite(final)||final<initial)throw new Error("Lecturas de maquinaria inválidas");
      const isMileage=(answers as any).unidad_medicion==="Kilometraje (km)";
      const{error:usageError}=await db.from("maquinaria_uso_diario").insert({equipo_id:String(equipment.id),equipo_tipo:equipment.tipo,equipo_patente:equipment.patente,obra_nombre:workName||equipment.obra_nombre||"Sin asignar",fecha:new Date().toISOString().slice(0,10),horometro_inicial:initial,horometro_final:final,horas_trabajadas:isMileage?0:Math.max(0,final-initial),combustible_cargado:Math.max(0,Number((answers as any).combustible)||0),operador:inspector,observaciones:clean((answers as any).observaciones,2000),empresa:form.empresa});
      if(usageError)throw usageError;
      await db.from("inventario_maquinaria").update({horometro_inicial:final}).eq("id",equipment.id).eq("empresa",form.empresa);
    }
    await log(true);return json({id:saved.id});
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:"Error inesperado"},500);}
});
