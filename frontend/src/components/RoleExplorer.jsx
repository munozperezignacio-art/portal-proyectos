import React,{useState,useRef} from 'react';
import {supabase} from '../supabaseClient';
import {companyPermissionCatalog,permissionModuleId} from '../utils/companyPermissions';
import {deriveRoleNavigation} from '../utils/roleNavigation';
import {can,PERMISSION_ACTIONS} from '../utils/permissionsCatalog';

const base=r=>String(r||'').trim().toLowerCase();
const admin=r=>/^administrador (de )?empresa$/.test(base(r));
export default function RoleExplorer({user}){
 const dialog=useRef(null),[roles,setRoles]=useState([]),[company,setCompany]=useState(null),[name,choose]=useState(''),[moduleId,visit]=useState(''),[status,setStatus]=useState('');
 if(!admin(user?.rol_base||user?.rol))return null;
 const open=async()=>{
  choose('');visit('');setRoles([]);setCompany(null);setStatus('Cargando roles…');dialog.current.showModal();
  try{
   const [list,config]=await Promise.all([supabase.from('roles').select('nombre,rol_base,empresa,permisos,modulos,submenus,archivado').eq('empresa',user.empresa).order('nombre'),supabase.from('config_empresa').select('empresa,modulos_activos,submenus_activos').eq('empresa',user.empresa).single()]);
   if(list.error||config.error)throw list.error||config.error;
   const available=list.data.filter(r=>!r.archivado&&r.nombre!==user.rol&&![r.nombre,r.rol_base].some(n=>admin(n)||/superusuario|superadmin/.test(base(n))));
   setCompany(config.data);setRoles(available);setStatus(available.length?'':'No hay roles inferiores activos en esta empresa.');
  }catch{setStatus('No se pudo leer la configuración. Cierra y vuelve a intentar.');}
 };
 const role=roles.find(r=>r.nombre===name),profile=role&&{empresa:user.empresa,rol:role.nombre,rol_base:role.rol_base};
 const nav=deriveRoleNavigation(role,company);
 const modules=companyPermissionCatalog(company).filter(m=>nav.modulos.some(id=>permissionModuleId(id)===m.id));
 const selected=modules.find(m=>m.id===moduleId);
 return <div className="px-4 pb-2"><button type="button" className="text-xs font-bold text-indigo-800" onClick={open}>Ver como otro rol</button>
 <dialog ref={dialog} className="m-auto max-h-[85vh] w-[min(94vw,48rem)] overflow-auto rounded-xl p-5 shadow-xl backdrop:bg-slate-900/40">
 <header className="flex items-center justify-between gap-2"><h2 className="font-bold">Vista de rol · {user.empresa}</h2><button type="button" onClick={()=>dialog.current.close()}>Salir de la vista</button></header>
 <p className="my-2 text-sm">Simulación de navegación. No cambia tu sesión ni incluye excepciones asignadas a una persona.</p>
 <label className="block">Rol a revisar<select className="block w-full rounded border p-2" value={name} onChange={e=>{choose(e.target.value);visit('');}}><option value="">Selecciona un rol</option>{roles.map(r=><option key={r.nombre}>{r.nombre}</option>)}</select></label>
 {status&&<p role="status">{status}</p>}{role&&<section className="mt-4"><h3 className="font-bold">Módulos habilitados</h3><nav className="my-2 flex flex-wrap gap-2">{modules.map(m=><button type="button" aria-pressed={moduleId===m.id} className="rounded border px-3 py-2 aria-pressed:bg-indigo-100" key={m.id} onClick={()=>visit(m.id)}>{m.label}</button>)}</nav>{!modules.length&&<p>Sin módulos habilitados.</p>}
 {selected&&<div><h3 className="font-bold">{selected.label}</h3>{selected.menus.map(menu=>{const allowed=menu.actions.filter(a=>can(profile,role.permisos,[selected.permissionModule||selected.id,menu.id,a].join('.')));return <p className="border-b py-2 text-sm" key={menu.id}><strong>{menu.label}</strong> · {allowed.map(a=>PERMISSION_ACTIONS.find(x=>x.id===a)?.label||a).join(', ')||'Sin permisos'}</p>;})}</div>}</section>}
 </dialog></div>;
}
