import React,{useState,useEffect} from 'react';
import {supabase} from '../supabaseClient';
import {deriveRoleNavigation} from '../utils/roleNavigation';

const base=r=>String(r||'').trim().toLowerCase();
const admin=r=>/^administrador (de )?empresa$/.test(base(r));
export default function RoleExplorer({user,name,onChange}){
 const [retry,setRetry]=useState(0),[roles,setRoles]=useState([]),[company,setCompany]=useState(null),[status,setStatus]=useState('');
 useEffect(()=>{if(!admin(user?.rol_base||user?.rol))return;let active=true;
 const open=async()=>{
  setRoles([]);setCompany(null);setStatus('Cargando roles…');
  try{
   const [list,config]=await Promise.all([supabase.from('roles').select('nombre,rol_base,empresa,permisos,modulos,submenus,archivado').eq('empresa',user.empresa).order('nombre'),supabase.from('config_empresa').select('empresa,modulos_activos,submenus_activos').eq('empresa',user.empresa).single()]);
   if(list.error||config.error)throw list.error||config.error;
   const available=list.data.filter(r=>!r.archivado&&r.nombre!==user.rol&&![r.nombre,r.rol_base].some(n=>admin(n)||/superusuario|superadmin/.test(base(n))));
   if(!active)return;setCompany(config.data);setRoles(available);setStatus(available.length?'':'No hay roles inferiores activos en esta empresa.');
  }catch{if(active)setStatus('No se pudieron cargar los roles.');}
 };open();return ()=>{active=false;};},[user.empresa,user.rol,user.rol_base,retry]);
 if(!admin(user?.rol_base||user?.rol))return null;
 return <div className="px-4 py-2 border-b border-slate-100">
 <label className="block text-xs font-bold text-slate-600">Ver como rol<select className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" value={name} onChange={e=>{const role=roles.find(r=>r.nombre===e.target.value);onChange(role?{role,nav:deriveRoleNavigation(role,company)}:null);}}><option value="">Mi rol · Administrador de Empresa</option>{roles.map(r=><option key={r.nombre}>{r.nombre}</option>)}</select></label>
 {status.startsWith('No se pudieron')&&<button type="button" onClick={()=>setRetry(v=>v+1)}>Reintentar</button>}
 {status&&<p role="status">{status}</p>}
 </div>;
}
