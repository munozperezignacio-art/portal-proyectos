import React,{useEffect,useRef,useState} from 'react';
import {supabase} from '../supabaseClient';
import {cleanRut,formatRut,validateRut} from '../utils/rutUtils';

export default function SupplierIdentityFields({company,form,setForm}) {
  const [hint,setHint]=useState('');
  const seq=useRef(0);
  useEffect(()=>()=>{seq.current++;},[company]);
  const invoice=form.asociar_factura==='SI';
  const input='mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs';
  async function lookup(){
    const id=++seq.current, rut=formatRut(form.proveedor_rut);
    setForm(x=>({...x,proveedor_rut:rut}));
    if(!validateRut(rut)||!company||form.proveedor_nombre?.trim())return;
    setHint('Buscando razón social…');
    const canonical=rut.replaceAll('.',''), variants=[rut,canonical,cleanRut(rut)].flatMap(v=>[v,v.toLowerCase()]);
    let unavailable=false;
    for(const [table,key,name,order] of [
      ['acreditaciones_proveedores','rut_empresa','empresa_nombre','created_at'],
      ['dte_documentos_operacion','rut_contraparte','razon_social_contraparte','fecha_emision'],
      ['costos_reales_obra','proveedor_rut','proveedor_nombre','id']
    ]){
      try{
        let q=supabase.from(table).select(key+','+name).eq('empresa',company).in(key,variants);
        if(table==='dte_documentos_operacion')q=q.eq('direccion','Recibido');
        const {data,error}=await q.order(order,{ascending:false}).limit(5);
        if(id!==seq.current)return;
        if(error){unavailable=true;continue;}
        const match=data?.find(row=>cleanRut(row[key])===cleanRut(rut)&&row[name]?.trim());
        if(match){
          setForm(x=>cleanRut(x.proveedor_rut)===cleanRut(rut)&&!x.proveedor_nombre?.trim()?{...x,proveedor_nombre:match[name].trim()}:x);
          setHint('Completado desde Obraxis. Puedes editar el nombre.');return;
        }
      }catch{if(id!==seq.current)return;unavailable=true;}
    }
    setHint(unavailable?'Consulta incompleta. Escribe la razón social.':'Sin coincidencia en Obraxis. Escribe la razón social.');
  }
  return <div className="space-y-2">
    <label className="block text-[10px] font-bold uppercase text-slate-500">RUT del emisor {invoice&&'*'}
      <input form="costo-inline" aria-label="RUT del emisor" required={invoice} maxLength={12} value={form.proveedor_rut||''} onChange={e=>{
        const value=e.target.value;seq.current++;setHint('');
        setForm(x=>({...x,proveedor_rut:value,proveedor_nombre:validateRut(x.proveedor_rut)&&cleanRut(value)!==cleanRut(x.proveedor_rut)?'':x.proveedor_nombre}));
      }} onBlur={lookup} placeholder="12.345.678-5" className={input}/>
    </label>
    <label className="block text-[10px] font-bold uppercase text-slate-500">Razón social del emisor {invoice&&'*'}
      <input form="costo-inline" aria-label="Razón social del emisor" required={invoice} maxLength={200} value={form.proveedor_nombre||''} onChange={e=>{const value=e.target.value;seq.current++;setHint('');setForm(x=>({...x,proveedor_nombre:value}));}} className={input}/>
    </label>
    <small role="status">{hint}</small>
  </div>;
}
