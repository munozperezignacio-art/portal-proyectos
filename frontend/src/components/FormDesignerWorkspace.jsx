import React, {createContext, useContext, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './FormDesignerWorkspace.css';

const DesignerContext = createContext(null);
const button = 'rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold';

export default function FormDesignerWorkspace({settings, palette, actions, title, description, children}) {
  const [tab, setTab] = useState('Diseño');
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState(null);
  const [search, setSearch] = useState('');
  const [mobile, setMobile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const draggedElement = useRef(null);
  return <DesignerContext.Provider value={{selected, setSelected, panel, preview:tab==='Vista previa'}}>
    <div className="form-designer" onChangeCapture={e=>{if(e.target.getAttribute('aria-label')!=='Buscar elementos')setDirty(true);}}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <nav aria-label="Etapas del diseñador" className="flex flex-wrap gap-2">{['Diseño','Ajustes','Vista previa'].map(name=><button key={name} type="button" aria-pressed={tab===name} onClick={()=>setTab(name)} className={`${button} ${tab===name?'bg-primary text-white':'bg-white text-slate-700'}`}>{name}</button>)}</nav>
        <span className="text-xs text-slate-500">{dirty?'Cambios sin guardar':'Guardado manual · revisa antes de guardar'}</span>
      </header>
      <div hidden={tab!=='Ajustes'} className="py-4">{settings}</div>
      {tab!=='Ajustes' && <div className={tab==='Diseño'?'designer-columns':'py-4'}>
        {tab==='Diseño' && <aside className="designer-palette rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <h3 className="mb-3 font-bold">Agregar elementos</h3>
          <input aria-label="Buscar elementos" placeholder="Buscar elementos…" value={search} onChange={e=>setSearch(e.target.value)} className="mb-3 w-full rounded-xl border border-slate-300 bg-white p-2 text-sm"/>
          <div ref={node=>{if(node)for(const el of node.querySelectorAll('button')) {el.hidden=!!search&&!el.textContent.toLocaleLowerCase().includes(search.toLocaleLowerCase());el.draggable=true;}}} onDragStart={e=>{const el=e.target.closest('button');if(!el)return;draggedElement.current=el;e.dataTransfer.setData('application/x-obraxis-element','add');e.dataTransfer.effectAllowed='copy';}} onDragEnd={()=>{draggedElement.current=null;}} onClickCapture={e=>{if(e.target.closest('button'))setDirty(true);}}>{palette}</div>
        </aside>}
        <main className="min-w-0 rounded-2xl bg-slate-50 p-3 sm:p-5" onDragOver={e=>{if(draggedElement.current){e.preventDefault();e.dataTransfer.dropEffect='copy';}}} onDrop={e=>{if(draggedElement.current){e.preventDefault();draggedElement.current.click();draggedElement.current=null;}}}>
          {tab==='Diseño'&&<p data-testid="element-drop" className="mb-3 rounded-xl border border-dashed border-primary/30 p-3 text-center text-xs text-slate-500">Arrastra aquí un elemento para agregarlo al final, o pulsa su botón.</p>}
          {tab==='Vista previa' && <div className="mb-4 flex flex-wrap gap-2"><button type="button" className={button} aria-pressed={!mobile} onClick={()=>setMobile(false)}>Escritorio</button><button type="button" className={button} aria-pressed={mobile} onClick={()=>setMobile(true)}>Móvil</button><p className="w-full text-xs text-slate-500">Vista de diseño. No envía respuestas ni consulta datos vinculados.</p></div>}
          <div className="mx-auto space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" style={{maxWidth:mobile&&tab==='Vista previa'?390:820}}>
            <header className="border-b border-slate-200 pb-4"><h2 className="text-xl font-extrabold text-slate-800">{title||'Formulario sin título'}</h2><p className="mt-2 text-sm text-slate-500">{description}</p></header>
            <div className={tab==='Vista previa'?'designer-preview':''} onClickCapture={e=>{if(e.target.closest('button[aria-label^="Subir"],button[aria-label^="Bajar"]'))setDirty(true);}}>{children}</div>
          </div>
        </main>
        {tab==='Diseño' && <aside className="designer-properties rounded-2xl border border-slate-200 bg-white p-4"><h3 className="mb-3 font-bold">Propiedades del campo</h3><p className="mb-3 text-xs text-slate-500">Selecciona una pregunta en el formulario. Las matrices se editan directamente en su tabla.</p><div ref={setPanel}/></aside>}
      </div>}
      <div className="designer-actions" onClickCapture={e=>{if(e.target.closest('button[type="submit"]'))setTab('Ajustes');}}>{actions}</div>
    </div>
  </DesignerContext.Provider>;
}

export function DesignerField({field, children}) {
  const context = useContext(DesignerContext);
  if(!context)return children;
  const {selected,setSelected,panel,preview}=context;
  return <>
    <button type="button" aria-label={`Editar ${field.label}`} aria-pressed={selected===field.id} disabled={preview} onClick={()=>setSelected(field.id)} className={`w-full rounded-xl border p-4 text-left ${selected===field.id&&!preview?'border-primary bg-primary/5':'border-slate-200 bg-white'}`}>
      <span className="block text-sm font-bold">{field.label}{field.required?' *':''}</span>
      <span className="mt-3 block text-sm text-slate-400">{['radio','checkbox'].includes(field.type)?(field.options||[]).map(o=>`${field.type==='radio'?'○':'□'} ${o}`).join('     '):field.type==='data_lookup'?'Seleccionar datos vinculados ▾':field.type==='signature'?'Espacio para firma':field.type==='repeater'?'Grupo de registros repetibles':field.type==='select'?'Seleccionar una opción ▾':field.type==='rating'?'☆ ☆ ☆ ☆ ☆':'________________________'}</span>
      {field.showWhen&&<span className="mt-2 block text-xs text-amber-700">Pregunta condicional</span>}
    </button>
    {selected===field.id&&!preview&&panel?createPortal(<div className="space-y-3">{children}</div>,panel):null}
  </>;
}
