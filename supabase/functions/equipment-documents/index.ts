import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const origins = new Set(['https://obraxis.cl','https://www.obraxis.cl']);
Deno.serve(async req => {
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://www.obraxis.cl','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply({error:'Método no permitido'},405);
 try {
  const raw=await req.text(); if(raw.length>1024)return reply({error:'Solicitud inválida'},400);
  const {token,documentId}=JSON.parse(raw);
  if(typeof token!=='string'||! /^[a-f0-9]{48}$/.test(token))return reply({error:'Enlace no disponible'},404);
  if(documentId && !/^[a-f0-9-]{36}$/.test(documentId))return reply({error:'Documento no disponible'},404);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:equipment,error}=await db.from('inventario_maquinaria').select('id,empresa').eq('publico_token',token).maybeSingle();
  if(error) return reply({error:'Servicio no disponible'},503);
  if(!equipment)return reply({error:'Enlace no disponible'},404);
  const config=await db.from('maquinaria_reporte_equipo').select('qr_activo').eq('equipo_id',equipment.id).eq('empresa',equipment.empresa).maybeSingle();
  if(config.error)return reply({error:'Servicio no disponible'},503);
  if(config.data?.qr_activo===false)return reply({error:'Enlace no disponible'},404);
  let query=db.from('equipo_documentos_qr').select('id,nombre,fecha_vencimiento').eq('equipo_id',equipment.id).eq('publico_qr',true).is('deleted_at',null).order('created_at');
  if(documentId)query=query.eq('id',documentId);
  const result=await query;
  if(result.error)return reply({error:'No se pudo consultar los documentos'},503);
  if(!documentId)return reply({documents:result.data});
  const doc=result.data?.[0];if(!doc)return reply({error:'Documento no disponible'},404);
  const signed=await db.storage.from('equipment-qr-documents').createSignedUrl(doc.id,60,{download:doc.nombre});
  if(signed.error)return reply({error:'Archivo no disponible'},404);
  return reply({url:signed.data.signedUrl});
 }catch{return reply({error:'No se pudo procesar la solicitud'},400);}
});
