import React,{useState} from 'react';

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const plate=v=>norm(v).replace(/[^A-Z0-9]/g,'');
const usable=v=>v && !/^(0+|NA|SN|SINPATENTE|SINNUMERO|NOAPLICA)$/.test(v);
const btn='rounded-lg border px-3 py-2 text-xs font-bold';
export default function MachineryHistoryTrial({equipment,logs}){
  const [rows,setRows]=useState([]),[choices,choose]=useState({}),[msg,say]=useState(''),[page,go]=useState(0),[busy,wait]=useState(false),[filter,show]=useState('');
  const [excluded,setExcluded]=useState(new Set());
  const [drafts,draft]=useState({});
  async function read(file){
    if(!file)return;
    draft({});setExcluded(new Set());wait(true);setRows([]);choose({});go(0);show('');say('');
    try{
      const X=await import('xlsx'),book=X.read(await file.arrayBuffer(),{type:'array'}),sheet=book.Sheets['Form responses'];
      if(!sheet)throw Error('No se encontró la hoja Form responses.');
      const [header,...data]=X.utils.sheet_to_json(sheet,{header:1,raw:true,blankrows:false}),cols=(header||[]).map(norm);
      const keys=['Submission ID','Fecha','Obra o Faena','Maquina','Patente','Horómetro de entrada','Horómetro de salida','Operador'].map(k=>cols.indexOf(norm(k)));
      if(keys.includes(-1))throw Error('Faltan columnas del reporte diario de maquinaria.');
      const result=data.map(r=>{
        const [id,raw,work,machine,tag,start,end,operator]=keys.map(i=>r[i]??'');
        const d=typeof raw==='number'?X.SSF.parse_date_code(raw,{date1904:!!book.Workbook?.WBProps?.date1904}):null;
        const date=d?[d.y,String(d.m).padStart(2,'0'),String(d.d).padStart(2,'0')].join('-'):'';
        return {id:String(id),date,work,machine,tag,start,end,operator,group:JSON.stringify([norm(work),norm(machine),plate(tag)])};
      });
      setRows(result);say(result.length?'':'No hay reportes en el archivo.');
    }catch(e){say(e.message)}finally{wait(false)}
  }
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Santiago'});
  const groups=new Map(),ids=new Map(),existing=new Set(logs.map(l=>String(l.equipo_id)+'|'+l.fecha));
  for(const r of rows){
    const key=usable(plate(r.tag))?'id:'+plate(r.tag):r.group;
    if(!groups.has(key))groups.set(key,{key,tag:r.tag,names:new Set(),works:new Set(),reports:[]});
    const g=groups.get(key);g.names.add(r.machine);g.works.add(r.work);g.reports.push(r);ids.set(r.id,1+(ids.get(r.id)||0));
  }
  const label=e=>[e.codigo_interno,e.tipo,e.marca,e.modelo,e.patente].filter(Boolean).join(' · ');
  const list=[...groups.values()].map(g=>{
    const words=new Set(norm([...g.names].join(' ')).split(/[^A-Z0-9]+/).filter(w=>w.length>1));
    const ranked=equipment.map(e=>{
      const exact=usable(plate(g.tag))&&[e.patente,e.codigo_interno].some(v=>plate(v)===plate(g.tag));
      const tokens=new Set(norm(label(e)).split(/[^A-Z0-9]+/));const score=[...words].filter(w=>tokens.has(w)).length;
      return {e,score,exact};
    }).sort((a,b)=>Number(b.exact)-Number(a.exact)||b.score-a.score||label(a.e).localeCompare(label(b.e)));
    const hits=ranked.filter(x=>x.exact),value=drafts[g.key]??choices[g.key]??(hits.length===1?String(hits[0].e.id):'');
    const state=excluded.has(g.key)?'Excluidos':choices[g.key]?'Asociados':'Pendientes';
    return {...g,ranked,value,state};
  }).sort((a,b)=>b.reports.length-a.reports.length);
  const visible=list.filter(g=>g.state===(filter||'Pendientes'));
  const activePage=Math.min(page,Math.max(0,Math.ceil(visible.length/25)-1));
  function exclude(g){
    if(window.confirm('¿Excluir este grupo y sus '+g.reports.length+' reportes de la prueba? El inventario no cambia.'))setExcluded(prev=>new Set([...prev,g.key]));
  }
  return <details className="rounded-xl border p-4"><summary className="cursor-pointer font-bold">Probar historial desde Excel</summary>
    <p className="my-3 text-sm">Revisa una vez cada patente o código. Sin identificador, se agrupa por descripción y obra: comprueba que sea el mismo equipo antes de asociarlo. No se guardan cambios en Obraxis.</p>
    <input aria-label="Excel de reportes diarios" type="file" accept=".xlsx" disabled={busy} onChange={e=>{read(e.target.files[0]);e.target.value=''}}/>
    <p role="status">{busy?'Leyendo reportes…':msg}</p>
    {!!rows.length&&<><p>{rows.length} reportes agrupados en {list.length} coincidencias de origen.</p>
    <label>Mostrar <select value={filter||'Pendientes'} onChange={e=>{show(e.target.value);go(0)}}>{['Pendientes','Asociados','Excluidos'].map(s=><option key={s}>{s}</option>)}</select> · {visible.length} grupos</label>
    {visible.slice(activePage*25,activePage*25+25).map(g=><section className="my-2 rounded-lg border p-3" key={g.key}>
    <strong>{[...g.names].join(' / ')} · {g.tag||'Sin patente'}</strong><p>{[...g.works].join(', ')} · {g.reports.length} reportes</p>
    {g.state!=='Excluidos'?<><select className="max-w-full" aria-label="Elegir coincidencia del inventario" value={g.value} onChange={e=>draft({...drafts,[g.key]:e.target.value})}><option value="">Elegir equipo de Obraxis</option>{g.ranked.map(x=><option key={x.e.id} value={x.e.id}>{x.exact?'Patente/código coincide: ':x.score?'Descripción similar: ':''}{label(x.e)}</option>)}</select>
    <button type="button" className={btn} disabled={!g.value} onClick={()=>choose({...choices,[g.key]:g.value})}>{g.state==='Asociados'?'Actualizar asociación':'Confirmar asociación'}</button>
    <button type="button" className={btn} onClick={()=>exclude(g)}>Excluir grupo</button></>:<button className={btn} onClick={()=>setExcluded(prev=>{const next=new Set(prev);next.delete(g.key);return next})}>Restaurar grupo</button>}
    <details><summary>Ver reportes del grupo</summary>{g.reports.map((r,i)=><p key={i}>{r.date||'Sin fecha'} · {r.work} · {r.operator} · Horómetro {r.start} → {r.end} {!r.date||r.date>today?' · Revisar fecha':''}{!r.id||ids.get(r.id)>1?' · Revisar identificador':''}{existing.has(g.value+'|'+r.date)?' · Revisar uso del mismo día':''}</p>)}</details></section>)}
    {!visible.length&&<p>No quedan grupos en esta vista.</p>}
    {visible.length>25&&<><button className={btn} disabled={!activePage} onClick={()=>go(activePage-1)}>Anterior</button> {activePage+1} / {Math.ceil(visible.length/25)} <button className={btn} disabled={(activePage+1)*25>=visible.length} onClick={()=>go(activePage+1)}>Siguiente</button></>}</>}
  </details>;
}
