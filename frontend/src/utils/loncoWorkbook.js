const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const rutKey=s=>norm(s).replace(/[^0-9k]/g,'');
export function loncoWorkbook(X,period,workers,marks,earnings){
 const book=X.utils.book_new(), people=new Map(), cols=['Días trabajados','Horas extras','Movilización','Colación','Sin Libro','Metas'];
 const byRut=new Map(workers.map(w=>[rutKey(w.rut),w]).filter(([r])=>r));
 function entry(w,date,work){
   let p=people.get(w.id);if(!p){p={w,rows:new Map()};people.set(w.id,p);}
   const key=JSON.stringify([date,work]);if(!p.rows.has(key))p.rows.set(key,{date,work,v:[0,0,0,0,0,0],extra:{}});
   return p.rows.get(key);
 }
 for(const m of marks){const w=byRut.get(rutKey(m.rut))||{id:'mark:'+ (rutKey(m.rut)||m.trabajador),nombre:m.trabajador,rut:m.rut};
   const r=entry(w,m.fecha_marcacion,m.obra_nombre||'');if(/^(presente|asisti|trabaj)/i.test(m.asistencia||'')){r.v[0]=1;r.v[1]+=Math.max(0,+m.horas_extras_auto||0,+m.horas_extras_manual||0);r.v[4]+=Number(m.otras_horas)||0;}
 }
 const extra=new Set();
 for(const h of earnings){const r=entry(h.worker,h.date,h.work),name=h.name.trim(),idx=({movilizacion:2,colacion:3,meta:5,metas:5})[norm(name)];
 if(typeof idx==='number')r.v[idx]+=Number(h.amount);else{extra.add(name);r.extra=Object.assign(Object.create(null),r.extra);r.extra[name]=(r.extra[name]||0)+Number(h.amount);}}
 if(!people.size)throw Error('No hay marcajes ni haberes para la selección.');
 const others=[...extra],head=[[],[null,null,null,'Informe Semanal de Personal',null,null,null,'Rev 0']],summary=[...head,[],['Período',period],['Colaborador','Obra',...cols,'Observaciones',...others]];
 const detail=[];const used=new Set(['resumen']);
 function append(name,rows,widths){const s=X.utils.aoa_to_sheet(rows);s.H1={t:'s',v:'RG-AD-06-01'};s['!cols']=widths.map(wch=>({wch}));X.utils.book_append_sheet(book,s,name);}
 for(const {w,rows} of people.values()){
 const list=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.work.localeCompare(b.work));
 const totals=list.reduce((t,r)=>t.map((v,i)=>v+(i<6?r.v[i]:r.extra[others[i-6]]||0)),Array(6+others.length).fill(0));
 summary.push([w.nombre,[...new Set(list.map(r=>r.work))].join(', '),...totals.slice(0,6),'',...totals.slice(6)]);
 const body=[...head,[],['Trabajador',w.nombre,null,w.cargo],['Período',period],['CC:',[...new Set(list.map(r=>r.work))].join(', ')],['Día','Fecha','Obra',...cols.slice(0,5),'Observaciones','Metas','Observaciones',...others]];
 const dates=new Set(list.map(r=>r.date)),days=new Date(Date.UTC(+period.slice(0,4),+period.slice(5),0)).getUTCDate();
 for(let n=1;n<=days;n++){const date=period+'-'+String(n).padStart(2,'0');if(!dates.has(date))list.push({date,work:'',v:[],extra:{}});}
 list.sort((a,b)=>(a.date.length===7)-(b.date.length===7)||a.date.localeCompare(b.date));
 for(const r of list){const daily=r.date.length===10;body.push([daily?new Date(r.date+'T00:00:00'):null,daily?new Date(r.date+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long'}):'Del mes',r.work,...Array.from({length:5},(_,i)=>r.v[i]),'',r.v[5],'',...others.map(k=>r.extra[k])]);}
 body.push(['','','Total',...totals.slice(0,5),'',totals[5],'',...totals.slice(6)]);
 const base=String(w.nombre||'Trabajador').replace(/[:\\/?*\[\]']/g,' ').trim()||'Trabajador';let name=base.slice(0,31),n=1;while(used.has(name.toLowerCase())){const suffix=' '+(++n);name=base.slice(0,31-suffix.length)+suffix;}used.add(name.toLowerCase());detail.push([name,body]);}
 append('RESUMEN',summary,[35,35,18,16,18,16,16,16,25,...others.map(()=>24)]);
 for(const [n,b] of detail)append(n,b,[18,24,34,29,18,18,18,18,24,16,24,...others.map(()=>24)]);
 return book;
}
