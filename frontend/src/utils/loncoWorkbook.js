const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const rutKey=s=>norm(s).replace(/[^0-9k]/g,'');
export const monthEnd=m=>new Date(Date.UTC(+m.slice(0,4),+m.slice(5),0)).toISOString().slice(0,10);
export function inRange(ref,from,to){return ref?.length===7?from<=ref+'-01'&&monthEnd(ref)<=to:ref>=from&&ref<=to;}
export function loncoWorkbook(X,period,workers,marks,earnings,from=period+'-01',to=monthEnd(period)){
 const label=d=>d.split('-').reverse().join('-');
 period=label(from)+' al '+label(to);
 marks=marks.filter(m=>inRange(m.fecha_marcacion,from,to));earnings=earnings.filter(h=>inRange(h.date,from,to));
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
 function append(name,rows,widths){const s=X.utils.aoa_to_sheet(rows,{dateNF:'dd-mm-yyyy'});s.H1={t:'s',v:'RG-AD-06-01'};s['!cols']=widths.map(wch=>({wch}));s['!ref']=X.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:widths.length-1}});
 const header=name==='RESUMEN'?4:6,line={style:'thin',color:{rgb:'CBD5E1'}};
 s['!merges']=[X.utils.decode_range('D2:G2')];s['!rows']=[];
 for(let r=0;r<rows.length;r++){const dark=r===1||r===header,total=name!=='RESUMEN'&&r===rows.length-1;
 s['!rows'][r]={hpt:r===1?26:r===header?30:20};
 for(let c=0;c<widths.length;c++){const k=X.utils.encode_cell({r,c}),cell=s[k]??={t:'s',v:''};cell.s={font:{name:'Calibri',sz:r===1?14:11,bold:dark||total,color:{rgb:dark?'FFFFFF':'17324D'}},fill:{patternType:'solid',fgColor:{rgb:dark?'203864':total?'C6E5DA':r>header&&r%2?'EEF4FA':'FFFFFF'}},alignment:{vertical:'center',wrapText:r===header},...(r>=header?{border:{top:line,bottom:line,left:line,right:line}}:{})};}}
 X.utils.book_append_sheet(book,s,name);}
 for(const {w,rows} of people.values()){
 const list=[...rows.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.work.localeCompare(b.work));
 const totals=list.reduce((t,r)=>t.map((v,i)=>v+(i<6?r.v[i]:r.extra[others[i-6]]||0)),Array(6+others.length).fill(0));
 summary.push([w.nombre,[...new Set(list.map(r=>r.work))].join(', '),...totals.slice(0,6),'',...totals.slice(6)]);
 const body=[...head,[],['Trabajador',w.nombre,null,w.cargo],['Período',period],['CC:',[...new Set(list.map(r=>r.work))].join(', ')],['Día','Fecha','Obra',...cols.slice(0,5),'Observaciones','Metas','Observaciones',...others]];
 const dates=new Set(list.map(r=>r.date));
 for(let t=Date.parse(from+'T00:00:00Z');t<=Date.parse(to+'T00:00:00Z');t+=86400000){const date=new Date(t).toISOString().slice(0,10);if(!dates.has(date))list.push({date,work:'',v:[],extra:{}});}
 list.sort((a,b)=>(a.date.length===7)-(b.date.length===7)||a.date.localeCompare(b.date));
 for(const r of list){const daily=r.date.length===10;body.push([daily?new Date(r.date+'T00:00:00'):null,daily?new Date(r.date+'T12:00:00').toLocaleDateString('es-CL',{weekday:'long'}):'Del mes '+r.date,r.work,...Array.from({length:5},(_,i)=>r.v[i]),'',r.v[5],'',...others.map(k=>r.extra[k])]);}
 body.push(['','','Total',...totals.slice(0,5),'',totals[5],'',...totals.slice(6)]);
 const base=String(w.nombre||'Trabajador').replace(/[:\\/?*\[\]']/g,' ').trim()||'Trabajador';let name=base.slice(0,31),n=1;while(used.has(name.toLowerCase())){const suffix=' '+(++n);name=base.slice(0,31-suffix.length)+suffix;}used.add(name.toLowerCase());detail.push([name,body]);}
 append('RESUMEN',summary,[35,35,18,16,18,16,16,16,25,...others.map(()=>24)]);
 for(const [n,b] of detail)append(n,b,[18,24,34,29,18,18,18,18,24,16,24,...others.map(()=>24)]);
 return book;
}
