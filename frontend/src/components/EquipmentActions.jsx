import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export default function EquipmentActions({equipment,canEdit,canDelete,onView,onEdit,onDelete}){
  const [position,setPosition]=useState(null),button=useRef(null),menu=useRef(null);
  useEffect(()=>{
    if(!position)return;
    const close=event=>{if(!button.current?.contains(event.target)&&!menu.current?.contains(event.target))setPosition(null);};
    const escape=event=>{if(event.key==='Escape'){setPosition(null);button.current?.focus();}};
    const scroll=event=>{if(!menu.current?.contains(event.target))setPosition(null);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);window.addEventListener('resize',scroll);window.addEventListener('scroll',scroll,true);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);window.removeEventListener('resize',scroll);window.removeEventListener('scroll',scroll,true);};
  },[position]);
  const choose=callback=>{setPosition(null);callback(equipment);};
  return <span onClick={event=>event.stopPropagation()}><button ref={button} type="button" aria-label={`Acciones ${equipment.patente||equipment.id}`} aria-expanded={Boolean(position)} onClick={()=>{
    if(position){setPosition(null);return;}
    const rect=button.current.getBoundingClientRect(),height=48+Number(canEdit)*40+Number(canDelete)*40;
    setPosition({left:Math.max(8,Math.min(window.innerWidth-192,rect.right-184)),top:rect.bottom+height+8<window.innerHeight?rect.bottom+4:Math.max(8,rect.top-height-4)});
  }} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold hover:bg-slate-50">⋮</button>{position&&createPortal(<div ref={menu} style={position} className="fixed z-[9999] w-[184px] rounded-xl border border-slate-200 bg-white p-1 shadow-lg" onClick={event=>event.stopPropagation()}><button onClick={()=>choose(onView)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Ver ficha</button>{canEdit&&<button onClick={()=>choose(onEdit)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">Editar equipo</button>}{canDelete&&<button onClick={()=>choose(onDelete)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Eliminar equipo</button>}</div>,document.body)}</span>;
}
