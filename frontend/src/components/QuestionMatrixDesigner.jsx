import React,{useState} from 'react';

// Keep individual radio IDs: saved responses and conditional rules reference them.
function parts(f){const label=String(f.label??''),i=label.indexOf(' · ');return i<0?null:[label.slice(0,i),label.slice(i+3)];}
export function matrixBlocks(fields){
 const result=[];
 fields.forEach((f,index)=>{
  const p=parts(f),key=f.type==='radio'&&p&&f.options?.length?JSON.stringify([f.matrixGroup||null,p[0],f.options]):null;
  const last=result[result.length-1];
  if(key&&last?.key===key)last.rows.push(f);
  else result.push({key,index,rows:[f]});
 });return result;
}
export function MatrixList({fields,setFields,children}){
 return matrixBlocks(fields).map(({index,rows})=>rows.length===1?children(rows[0],index):<MatrixEditor key={rows[0].id} rows={rows} index={index} renderIndividual={children} onApply={next=>setFields(fields=>{const start=fields.findIndex(f=>f.id===rows[0].id);return start<0?fields:[...fields.slice(0,start),...next,...fields.slice(start+rows.length)]})}/>);
}
const input='min-w-0 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm';
const button='rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-primary';
export function newMatrixRows(){const id=crypto.randomUUID();return [1,2].map(n=>({type:'radio',id:crypto.randomUUID(),matrixGroup:id,label:'Nueva sección · Pregunta '+n,options:['Bueno','Regular','Malo','N/A'],required:true}));}
export function MatrixEditor({rows,onApply,renderIndividual,index}){
 const [draft,setDraft]=useState(null),[details,setDetails]=useState(false);
 const section=parts(rows[0])[0],opts=rows[0].options;
 const start=()=>{setDetails(false);setDraft({title:section,options:[...opts],rows:rows.map(f=>({...f,question:parts(f)[1]}))});};
 const valid=draft&&draft.title.trim()&&!draft.title.includes(' · ')&&draft.rows.every(r=>r.question.trim())&&draft.options.every(o=>o.trim())&&new Set(draft.options.map(o=>o.trim().toLocaleLowerCase())).size===draft.options.length;
 const updateRow=(i,changes)=>setDraft({...draft,rows:draft.rows.map((r,j)=>i===j?{...r,...changes}:r)});
 return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
 <header className="flex flex-wrap items-center justify-between gap-2"><div><small>Matriz de preguntas y respuestas</small><h3 className="font-bold">{section}</h3></div>{!draft&&<div className="flex gap-2"><button type="button" className={button} onClick={start}>Editar matriz</button><button type="button" className={button} onClick={()=>setDetails(!details)}>{details?'Volver a la tabla':'Opciones por campo'}</button></div>}</header>
 {details?rows.map((f,i)=>renderIndividual(f,index+i)):<>
 {draft&&<label>Título de sección<input className={input} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>}
 <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Pregunta</th>{(draft?.options||opts).map((o,i)=><th className="p-2" key={i}>{draft?<><input aria-label={'Alternativa '+(i+1)} className={input} value={o} onChange={e=>setDraft({...draft,options:draft.options.map((v,j)=>i===j?e.target.value:v)})}/><button type="button" disabled={draft.options.length<=2} onClick={()=>setDraft({...draft,options:draft.options.filter((_,j)=>j!==i)})}>Quitar</button></>:o}</th>)}{draft&&<th>Obligatoria</th>}</tr></thead>
 <tbody>{(draft?.rows||rows).map((r,i)=><tr key={r.id} className="border-t"><td className="p-2">{draft?<input aria-label={'Pregunta '+(i+1)} className={input} value={r.question} onChange={e=>updateRow(i,{question:e.target.value})}/>:parts(r)[1]+(r.required?' *':'')}</td>{(draft?.options||opts).map((_,j)=><td key={j} className="text-center text-slate-400" aria-hidden="true">○</td>)}{draft&&<td className="text-center"><input aria-label={'Pregunta obligatoria '+(i+1)} type="checkbox" checked={!!r.required} onChange={e=>updateRow(i,{required:e.target.checked})}/></td>}</tr>)}</tbody></table></div>
 {draft&&<div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>setDraft({...draft,rows:[...draft.rows,{id:crypto.randomUUID(),matrixGroup:rows[0].matrixGroup,type:'radio',question:'',required:true}]})}>+ Pregunta</button><button type="button" className={button} onClick={()=>setDraft({...draft,options:[...draft.options,'']})}>+ Alternativa</button><button type="button" className={button} disabled={!valid} onClick={()=>{onApply(draft.rows.map(({question,...f})=>({...f,label:draft.title.trim()+' · '+question.trim(),options:draft.options.map(o=>o.trim())})));setDraft(null)}}>Aplicar a la matriz</button><button type="button" className={button} onClick={()=>setDraft(null)}>Cancelar</button></div>}
 </>}</section>
}
