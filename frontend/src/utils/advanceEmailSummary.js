import { calendarTimeline, calendarLabelIndices } from './sCurveTimeline.js';
import { plannedValueAt } from './plannedProgress.js';
import { matchesWorkReport } from './workReportCalculations.js';

export const escapeEmailText = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reportDate = r => String(r.fecha || r.fecha_avance || r.created_at || '').slice(0,10);
const pct = (value,total) => total>0 ? Math.round(value/total*1000)/10 : null;
export function buildAdvanceEmailSummary({ parts, reports, cutoff, start, businessDays }) {
  const executable=parts.filter(p=>!p.es_titulo && !['TITULO','GRUPO'].includes(p.unidad));
  const scoped=reports.filter(r=>reportDate(r) && reportDate(r)<=cutoff);
  const total=executable.reduce((s,p)=>s+Math.round(p.quantity*p.unitPrice),0);
  const earliest=[start,...executable.map(p=>p.start),...scoped.map(reportDate),cutoff].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')).sort()[0];
  const dates=calendarTimeline(earliest,cutoff);
  const increments=new Map();
  for(const r of scoped) {
    const index=executable.findIndex(p=>matchesWorkReport(r,p));
    if(index<0)continue;
    const key=reportDate(r);if(!increments.has(key))increments.set(key,new Map());
    const day=increments.get(key);day.set(index,(day.get(index)||0)+(Number(r.cantidad)||0));
  }
  const quantities=executable.map(()=>0);
  const points=dates.map(d=>{
    for(const [index,quantity] of increments.get(d.dateStr)||[])quantities[index]+=quantity;
    const real=executable.reduce((s,p,i)=>s+Math.round(Math.max(0,Math.min(p.quantity,quantities[i]))*p.unitPrice),0);
    const planned=plannedValueAt(executable,d.dateStr,businessDays);
    return {...d,real,planned,realPct:pct(real,total),plannedPct:pct(planned,total)};
  });
  const recentDates=calendarTimeline(new Date(Date.parse(`${cutoff}T12:00:00Z`)-4*86400000).toISOString().slice(0,10),cutoff);
  const recent=recentDates.map(d=>({ ...d,items:executable.map((p,i)=>({partida:p.partida,unidad:p.unidad,quantity:increments.get(d.dateStr)?.get(i)||0})),
    reports:scoped.filter(r=>reportDate(r)===d.dateStr && executable.some(p=>matchesWorkReport(r,p))).length }));
  return {cutoff,total,points,recent,latest:points.at(-1),gap:points.at(-1)?.realPct == null ? null : Math.round((points.at(-1).realPct-points.at(-1).plannedPct)*10)/10};
}

export function renderAdvanceSummaryHtml(summary, hasImage) {
  const e=escapeEmailText,percent=v=>v==null?'N/D':`${v.toFixed(1)}%`;
  const recent=summary.recent.map(d=>`<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${e(d.dateStr)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.items.filter(p=>p.quantity!==0).map(p=>`${e(p.partida)}: <b>${e(p.quantity.toLocaleString('es-CL'))} ${e(p.unidad)}</b>`).join('<br>')||'Sin producción reportada'}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.reports}</td></tr>`).join('');
  return `<h3 style="font-size:16px;color:#1e3a8a;">Curva S — acumulado al ${e(summary.cutoff)}</h3>
    <p style="font-size:13px;"><b>Real: ${percent(summary.latest?.realPct)} · Programado: ${percent(summary.latest?.plannedPct)}</b><br>Diferencia: ${summary.gap==null?'N/D':`${summary.gap>0?'+':''}${summary.gap.toFixed(1)} puntos porcentuales`}</p>
    ${hasImage?'<img src="cid:obraxis-curva-s" alt="Curva S diaria: avance acumulado real y programado al corte del reporte" width="600" style="display:block;width:100%;max-width:600px;height:auto;"/>':'<p>La imagen no está disponible; consulte los valores acumulados anteriores.</p>'}
    <p style="font-size:11px;color:#64748b;">Comparación valorizada con las mismas partidas, precios y programación del panel. Incluye este reporte y excluye fechas posteriores al corte. La programación corresponde a la versión vigente al enviar el correo.</p>
    <h3 style="font-size:15px;color:#1e3a8a;">Producción de los últimos 5 días calendario</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f1f5f9;text-align:left;"><th style="padding:8px;">Fecha</th><th style="padding:8px;">Rendimiento por partida (cantidad/día)</th><th style="padding:8px;">Reportes</th></tr></thead><tbody>${recent}</tbody></table>
    <p style="font-size:11px;color:#64748b;">No se suman cantidades de unidades distintas. “Sin producción reportada” no demuestra que no se haya trabajado.</p>`;
}

export function advanceCurveAttachment(summary, documentObject = globalThis.document) {
  if(!summary.points.length || !(summary.total>0))return null;
  const canvas=documentObject.createElement('canvas');canvas.width=1200;canvas.height=640;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.scale(2,2);ctx.fillStyle='#fff';ctx.fillRect(0,0,600,320);
  const left=48,right=578,top=30,bottom=260,width=right-left;
  const x=i=>left+i/Math.max(1,summary.points.length-1)*width,y=v=>bottom-v/100*(bottom-top);
  ctx.font='11px Arial';
  for(const value of [0,25,50,75,100]) {ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(right,y(value));ctx.stroke();ctx.fillStyle='#64748b';ctx.textAlign='right';ctx.fillText(`${value}%`,left-8,y(value)+4);}
  for(const [key,color,dash] of [['plannedPct','#16a34a',[5,3]],['realPct','#1e3a8a',[]]]) {
    ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.setLineDash(dash);ctx.beginPath();summary.points.forEach((p,i)=>i?ctx.lineTo(x(i),y(p[key])):ctx.moveTo(x(i),y(p[key])));ctx.stroke();
    ctx.setLineDash([]);
    for(const i of calendarLabelIndices(summary.points.length,width,100)) {const p=summary.points[i];ctx.fillStyle=color;ctx.beginPath();ctx.arc(x(i),y(p[key]),3,0,Math.PI*2);ctx.fill();ctx.textAlign=i===0?'left':i===summary.points.length-1?'right':'center';ctx.font='bold 10px Arial';const offset=key==='plannedPct'?-10:Math.abs(p.realPct-p.plannedPct)<12?16:-9;ctx.fillText(`${p[key].toFixed(1)}%`,x(i),Math.max(14,Math.min(278,y(p[key])+offset)));}
  }
  for(const i of calendarLabelIndices(summary.points.length,width,100)) {ctx.font='10px Arial';ctx.fillStyle='#475569';ctx.textAlign=i===0?'left':i===summary.points.length-1?'right':'center';ctx.fillText(summary.points[i].dateStr.slice(5).split('-').reverse().join('/'),x(i),296);}
  ctx.textAlign='left';ctx.font='bold 11px Arial';ctx.fillStyle='#1e3a8a';ctx.fillText('Real acumulado',left,15);ctx.fillStyle='#16a34a';ctx.fillText('Programado acumulado',210,15);
  return {filename:`Curva-S-${summary.cutoff}.png`,content:canvas.toDataURL('image/png').split(',')[1],content_type:'image/png',content_id:'obraxis-curva-s'};
}
