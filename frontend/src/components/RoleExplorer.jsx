import React,{useState,useEffect} from 'react';
import {supabase} from '../supabaseClient';
import {companyPermissionCatalog,permissionModuleId} from '../utils/companyPermissions';
import {deriveRoleNavigation} from '../utils/roleNavigation';
import {can,PERMISSION_ACTIONS} from '../utils/permissionsCatalog';

const base=r=>String(r||'').trim().toLowerCase();
const admin=r=>/^administrador (de )?empresa$/.test(base(r));
export default function RoleExplorer({user}){
 const [retry,setRetry]=useState(0),[roles,setRoles]=useState([]),[company,setCompany]=useState(null),[name,choose]=useState(''),[moduleId,visit]=useState(''),[status,setStatus]=useState('');
 useEffect(()=>{if(!admin(user?.rol_base||user?.rol))return;let active=true;
 const open=async()=>{
  choose('');visit('');setRoles([]);setCompany(null);setStatus('Cargando roles…');
  try{
   const [list,config]=await Promise.all([supabase.from('roles').select('nombre,rol_base,empresa,permisos,modulos,submenus,archivado').eq('empresa',user.empresa).order('nombre'),supabase.from('config_empresa').select('empresa,modulos_activos,submenus_activos').eq('empresa',user.empresa).single()]);
   if(list.error||config.error)throw list.error||config.error;
   const available=list.data.filter(r=>!r.archivado&&r.nombre!==user.rol&&![r.nombre,r.rol_base].some(n=>admin(n)||/superusuario|superadmin/.test(base(n))));
   if(!active)return;setCompany(config.data);setRoles(available);setStatus(available.length?'':'No hay roles inferiores activos en esta empresa.');
  }catch{if(active)setStatus('No se pudieron cargar los roles.');}
 };open();return ()=>{active=false;};},[user.empresa,user.rol,user.rol_base,retry]);
 if(!admin(user?.rol_base||user?.rol))return null;
 const role=roles.find(r=>r.nombre===name),profile=role&&{empresa:user.empresa,rol:role.nombre,rol_base:role.rol_base};
 const nav=deriveRoleNavigation(role,company);
 const modules=companyPermissionCatalog(company).filter(m=>nav.modulos.some(id=>permissionModuleId(id)===m.id));
 const selected=modules.find(m=>m.id===moduleId);
 return <div className="px-4 py-2 border-b border-slate-100">
 <label className="block text-xs font-bold text-slate-600">Ver como rol<select className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" value={name} onChange={e=>{choose(e.target.value);visit('');}}><option value="">Mi rol · Administrador de Empresa</option>{roles.map(r=><option key={r.nombre}>{r.nombre}</option>)}</select></label>
 {status.startsWith('No se pudieron')&&<button type="button" onClick={()=>setRetry(v=>v+1)}>Reintentar</button>}
 {status&&<p role="status">{status}</p>}{role&&<section className="mt-2 max-h-[35vh] overflow-auto text-xs"><p className="text-slate-500">Vista de solo lectura</p><h3 className="font-bold">Módulos habilitados</h3><nav className="my-2 flex flex-wrap gap-2">{modules.map(m=><button type="button" aria-pressed={moduleId===m.id} className="rounded border px-3 py-2 aria-pressed:bg-indigo-100" key={m.id} onClick={()=>visit(m.id)}>{m.label}</button>)}</nav>{!modules.length&&<p>Sin módulos habilitados.</p>}
 {selected&&<div><h3 className="font-bold">{selected.label}</h3>{selected.menus.map(menu=>{const allowed=menu.actions.filter(a=>can(profile,role.permisos,[selected.permissionModule||selected.id,menu.id,a].join('.')));return <p className="border-b py-2 text-sm" key={menu.id}><strong>{menu.label}</strong> · {allowed.map(a=>PERMISSION_ACTIONS.find(x=>x.id===a)?.label||a).join(', ')||'Sin permisos'}</p>;})}</div>}</section>}
 </div>;
}
