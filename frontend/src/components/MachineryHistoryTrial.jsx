import React,{useState} from 'react';

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const plate=v=>norm(v).replace(/[^A-Z0-9]/g,'');
const usable=v=>v && !/^(0+|NA|SN|SINPATENTE|SINNUMERO|NOAPLICA)$/.test(v);
const btn='rounded-lg border px-3 py-2 text-xs font-bold';
export default function MachineryHistoryTrial({equipment,logs}){
  const [rows,setRows]=useState([]),[choices,choose]=useState({}),[msg,say]=useState(''),[page,go]=useState(0),[busy,wait]=useState(false),[filter,show]=useState('');
  const [excluded,setExcluded]=useState(new Set());
  async function read(file){
    if(!file)return;
    setExcluded(new Set());wait(true);setRows([]);choose({});go(0);show('');say('');
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
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Santiago'}),ids=new Map(),matches=new Map(),existing=new Set(logs.map(l=>String(l.equipo_id)+'|'+l.fecha));
  for(const r of rows)ids.set(r.id,(ids.get(r.id)||0)+1);
  for(const e of equipment)for(const k of new Set([plate(e.patente),plate(e.codigo_interno)])){if(usable(k))matches.set(k,[...(matches.get(k)||[]),String(e.id)])}
  const list=rows.map(r=>{
    const hits=matches.get(plate(r.tag))||[],eq=choices[r.group]??(hits.length===1?hits[0]:'');
    const excludeKey=usable(plate(r.tag))?plate(r.tag):r.group;
    const status=excluded.has(excludeKey)?'Excluido':!r.id||ids.get(r.id)>1?'Identificador ausente o repetido':!r.date||r.date>today?'Revisar fecha':!eq?'Elegir equipo':existing.has(eq+'|'+r.date)?'Revisar uso del mismo día':'Equipo asociado';
    return {...r,eq,status,excludeKey};
  }),visible=list.filter(r=>filter?r.status===filter:!['Excluido','Equipo asociado'].includes(r.status)),counts=list.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
  function exclude(r){
    const count=list.filter(item=>item.excludeKey===r.excludeKey).length;
    if(!window.confirm('¿Excluir '+count+' filas de '+r.machine+' ('+(usable(plate(r.tag))?'patente/código '+r.tag:'sin identificador fiable; solo esta descripción y obra: '+r.work)+') de esta prueba? No se borra nada del inventario.'))return;
    setExcluded(prev=>new Set([...prev,r.excludeKey]));go(0);
  }
  return <details className="rounded-xl border p-4"><summary className="cursor-pointer font-bold">Probar historial desde Excel</summary>
    <p className="my-3 text-sm">Simulación local: no guarda reportes ni modifica costos, horómetros o asignaciones. Una selección manual se aplica a las filas con la misma obra, máquina y patente de origen.</p>
    <input aria-label="Excel de reportes diarios" type="file" accept=".xlsx" disabled={busy} onChange={e=>{read(e.target.files[0]);e.target.value=''}}/>
    <p role="status">{busy?'Leyendo reportes…':msg}</p>
    {!!rows.length&&<><label>Mostrar <select value={filter} onChange={e=>{show(e.target.value);go(0)}}><option value="">Pendientes ({rows.length-(counts.Excluido||0)-(counts['Equipo asociado']||0)})</option>{Object.entries(counts).map(([s,n])=><option key={s} value={s}>{s} ({n})</option>)}</select></label>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Fecha / obra','Máquina / patente Excel','Operador','Horómetro inicial → final','Equipo Obraxis','Resultado','Acción'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{visible.slice(page*25,page*25+25).map((r,i)=><tr key={i} className="border-t"><td>{r.date||'Sin fecha válida'} · {r.work}</td><td>{r.machine} · {r.tag}</td><td>{r.operator}</td><td>{r.start} → {r.end}</td><td><select aria-label="Equipo asociado" value={r.eq} onChange={e=>{choose({...choices,[r.group]:e.target.value});go(0)}}><option value="">Seleccionar equipo</option>{equipment.map(e=><option key={e.id} value={e.id}>{[e.codigo_interno,e.tipo,e.patente].filter(Boolean).join(' · ')}</option>)}</select></td><td>{r.status}</td><td>{r.status==='Excluido'?<button className={btn} onClick={()=>{setExcluded(prev=>{const next=new Set(prev);next.delete(r.excludeKey);return next});go(0)}}>Restaurar</button>:<button className={btn} onClick={()=>exclude(r)}>Excluir del Excel</button>}</td></tr>)}</tbody></table></div>
    {!visible.length&&<p>No quedan filas en esta vista.</p>}
    <button className={btn} disabled={!page} onClick={()=>go(page-1)}>Anterior</button> {page+1} / {Math.max(1,Math.ceil(visible.length/25))} <button className={btn} disabled={(page+1)*25>=visible.length} onClick={()=>go(page+1)}>Siguiente</button></>}
  </details>;
}
