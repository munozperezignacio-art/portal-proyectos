import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "https://esm.sh/@supabase/supabase-js@2.110.6";
import {codes,day,validDate,normalizeSeries,alternativeSeries,usableQuote} from './quotes.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
const get=async(url:string)=>{const res=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error('Proveedor no disponible');return res.json();};
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({error:'Método no permitido'},405);
  try{
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
    const secret=req.headers.get('x-cron-secret');let cron=false;
    if(secret){const result=await db.rpc('verify_internal_cron_secret',{p_secret:secret});cron=result.data===true;}
    if(!cron){
      const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
      if(!token)return json({error:'Debes iniciar sesión'},401);
      const {data,error}=await db.auth.getUser(token);if(error||!data.user)return json({error:'Sesión no válida'},401);
    }
    const body=await req.json().catch(()=>({}));const today=day();const date=body.fecha||today;
    if(!validDate(date)||date>today||date<'2000-01-01')return json({error:'Fecha de indicador inválida'},400);
    const since=new Date(Date.parse(date)-40*86400000).toISOString().slice(0,10);
    const cached=await db.from('indicadores_economicos_cache').select('*').gte('fecha',since).lte('fecha',date).order('fecha',{ascending:false});
    if(cached.error)throw cached.error;
    const currencies=Object.keys(codes);let rows=cached.data||[];
    // Usuarios leen el respaldo; solo consultan proveedores si falta un indicador.
    if(cron||currencies.some(currency=>!usableQuote(rows,currency,date))){
      const incoming:any[]=[];
      await Promise.all(currencies.filter(currency=>cron||!usableQuote(rows,currency,date)).map(async currency=>{
        try{
          const [y,m,d]=date.split('-');
          const suffix=date===today?'':`/${d}-${m}-${y}`;
          incoming.push(...normalizeSeries(await get(`https://mindicador.cl/api/${codes[currency]}${suffix}`),currency,today));
        }catch{ /* Un fallo no elimina cotizaciones verificadas anteriores. */ }
      }));
      await Promise.all(currencies.filter(currency=>!usableQuote(incoming,currency,date)).map(async currency=>{
        try{incoming.push(...alternativeSeries(await get(`https://indicadores.cl/api/v1/${codes[currency]}.json`),currency,today).filter(row=>row.fecha>=since));}
        catch{ /* Se mantiene la última publicación conocida, nunca un dato de otra fecha. */ }
      }));
      const unique=[...new Map(incoming.map(row=>[`${row.moneda}:${row.fecha}`,{...row,consultado_en:new Date().toISOString()}])).values()];
      if(unique.length){const result=await db.from('indicadores_economicos_cache').upsert(unique,{onConflict:'moneda,fecha'});if(result.error)throw result.error;}
      rows=[...incoming,...rows];
    }
    const data=currencies.map(currency=>usableQuote(rows,currency,date)).filter(Boolean);
    return json({data,fecha_consulta:date,pendientes:currencies.filter(currency=>!usableQuote(rows,currency,date))});
  }catch{ return json({error:'No se pudo actualizar el respaldo de indicadores. Se conservan los valores anteriores.'},503); }
});
