const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const number = value => Number(value) || 0;
const money = value => `$${Math.round(number(value)).toLocaleString('es-CL')}`;
const ratio = (a, b) => b > 0 ? a / b : null;
const day = 86400000;
const isoDate = value => { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; };
const tone = value => value == null ? '#64748b' : value >= 1 ? '#047857' : value >= .9 ? '#b45309' : '#be123c';
const state = value => value == null ? 'Sin base' : value >= 1 ? 'Favorable' : value >= .9 ? 'Atención' : 'Crítico';
const responseText = value => String(typeof value === 'string' ? value : JSON.stringify(value || {})).toLowerCase();
const responseNumber = (value, keys) => {
  if (!value || typeof value !== 'object') return 0;
  return Object.entries(value).reduce((sum, [key, child]) => keys.some(term => key.toLowerCase().includes(term)) ? sum + number(child) : sum + (child && typeof child === 'object' ? responseNumber(child, keys) : 0), 0);
};
const planningKey = value => String(value || '').trim().toLocaleLowerCase('es-CL').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function pointsFor(parts, advances, costs, periodDays) {
  const today = new Date();
  const datedStarts = parts.map(item => isoDate(item.fecha_inicio)).filter(Boolean);
  const datedEnds = parts.map(item => isoDate(item.fecha_termino)).filter(Boolean);
  const dataDates = [...advances.map(item => isoDate(item.created_at)), ...costs.map(item => isoDate(item.created_at))].filter(Boolean);
  const fallbackStart = dataDates.length ? new Date(Math.min(...dataDates.map(date => date.getTime()))) : new Date(today.getTime() - periodDays * day);
  const start = datedStarts.length ? new Date(Math.min(...datedStarts.map(date => date.getTime()))) : fallbackStart;
  const fallbackEnd = new Date(Math.max(today.getTime(), start.getTime() + Math.max(90, periodDays) * day));
  const end = datedEnds.length ? new Date(Math.max(...datedEnds.map(date => date.getTime()))) : fallbackEnd;
  const horizon = Math.max(day, end.getTime() - start.getTime());
  const dates = Array.from({ length: 8 }, (_, index) => new Date(start.getTime() + horizon * index / 7));
  const budgets = parts.filter(item => number(item.cantidad_presupuestada) > 0).map(item => ({
    ...item,
    qty: number(item.cantidad_presupuestada),
    unitPrice: number(item.costo_por_dia),
    value: number(item.cantidad_presupuestada) * number(item.costo_por_dia),
    start: isoDate(item.fecha_inicio) || start,
    end: isoDate(item.fecha_termino) || (number(item.rendimiento_meta) > 0 ? new Date((isoDate(item.fecha_inicio) || start).getTime() + Math.ceil(number(item.cantidad_presupuestada) / number(item.rendimiento_meta)) * day) : end)
  }));
  const bac = budgets.reduce((sum, item) => sum + item.value, 0);
  const earnedAt = date => budgets.reduce((sum, item) => {
    const reported = advances.filter(report => { const reportDate=isoDate(report.created_at); return report.partida === item.partida && reportDate && reportDate <= date; }).reduce((total, report) => total + number(report.cantidad), 0);
    return sum + Math.min(item.qty, reported) * item.unitPrice;
  }, 0);
  const plannedAt = date => budgets.reduce((sum, item) => {
    if (date < item.start) return sum;
    const duration = Math.max(day, item.end.getTime() - item.start.getTime());
    return sum + item.value * Math.min(1, Math.max(0, (date.getTime() - item.start.getTime()) / duration));
  }, 0);
  const current = { date: today, pv: plannedAt(today), ev: earnedAt(today), ac: costs.filter(item => { const costDate=isoDate(item.created_at); return costDate && costDate <= today; }).reduce((sum, item) => sum + number(item.monto), 0) };
  let low=start.getTime(), high=Math.max(start.getTime(),Math.min(today.getTime(),end.getTime()));
  for(let index=0;index<30;index+=1){const middle=(low+high)/2;if(plannedAt(new Date(middle))<current.ev)low=middle;else high=middle;}
  const earnedDate=new Date((low+high)/2);
  return {
    bac,
    current,
    scheduleVarianceDays: Math.round((earnedDate.getTime()-today.getTime())/day),
    incompleteSchedule: datedStarts.length < budgets.length || budgets.some(item => !isoDate(item.fecha_termino) && number(item.rendimiento_meta) <= 0),
    points: dates.map(date => ({
      date,
      pv: plannedAt(date),
      ev: earnedAt(date),
      ac: costs.filter(item => { const costDate=isoDate(item.created_at); return costDate && costDate <= date; }).reduce((sum, item) => sum + number(item.monto), 0)
    }))
  };
}

function curveSvg(points, bac) {
  const width = 680, height = 235, left = 48, top = 20, chartW = 604, chartH = 160;
  const max = Math.max(bac, ...points.flatMap(point => [point.pv, point.ev, point.ac]), 1);
  const coords = key => points.map((point, index) => `${left + chartW * index / (points.length - 1)},${top + chartH - chartH * point[key] / max}`).join(' ');
  const grid = [0, .25, .5, .75, 1].map(level => `<line x1="${left}" y1="${top + chartH * level}" x2="${left + chartW}" y2="${top + chartH * level}" stroke="#e2e8f0"/><text x="4" y="${top + chartH * level + 4}" font-size="9" fill="#64748b">${Math.round((1-level)*100)}%</text>`).join('');
  const labels = points.map((point, index) => `<text x="${left + chartW * index / (points.length - 1)}" y="202" text-anchor="middle" font-size="8" fill="#64748b">${point.date.toLocaleDateString('es-CL',{month:'short',year:'2-digit'})}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Curva S de valor ganado">${grid}<polyline points="${coords('pv')}" fill="none" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round"/><polyline points="${coords('ev')}" fill="none" stroke="#059669" stroke-width="4" stroke-linecap="round"/><polyline points="${coords('ac')}" fill="none" stroke="#ea580c" stroke-width="4" stroke-linecap="round"/>${labels}<g font-size="10" font-weight="700"><text x="48" y="228" fill="#1d4ed8">● Planificado (PV)</text><text x="185" y="228" fill="#059669">● Ganado (EV)</text><text x="298" y="228" fill="#ea580c">● Costo real (AC)</text></g></svg>`;
}

export function buildExecutiveReportHtml({ schedule, company, selected, advances, attendance, costs, nonConformities, prevention, parts, planning = [], equipmentUse = [], failures = [], maintenance = [], personnel = [], periodDays = 7 }) {
  const periodStart = new Date(Date.now() - periodDays * day);
  const cards = selected.map(name => {
    const workPlanning = planning.filter(item => item.obra_nombre === name);
    const workParts = parts.filter(item => item.obra_nombre === name).map(item => {
      const plan = workPlanning.find(task => planningKey(task.partida || task.tarea) === planningKey(item.partida));
      return plan ? { ...item, fecha_inicio: plan.fecha_inicio || item.fecha_inicio, fecha_termino: plan.fecha_fin || item.fecha_termino, duracion_programada: plan.duracion } : item;
    });
    const workAdvances = advances.filter(item => item.obra_nombre === name);
    const workCosts = costs.filter(item => item.obra_nombre === name);
    const curve = pointsFor(workParts, workAdvances, workCosts, periodDays);
    const current = curve.current || { pv:0, ev:0, ac:0 };
    const spi = ratio(current.ev, current.pv), cpi = ratio(current.ev, current.ac);
    return {
      name, ...curve, current, spi, cpi,
      sv: current.ev-current.pv, cv: current.ev-current.ac,
      eac: cpi && cpi > 0 ? curve.bac/cpi : null,
      reports: workAdvances.filter(item => isoDate(item.created_at) >= periodStart).length,
      present: attendance.filter(item => item.obra_nombre === name && isoDate(item.created_at) >= periodStart && !['Ausente','No'].includes(item.asistencia)).length,
      open: nonConformities.filter(item => item.obra_nombre === name && !['Cerrada','Cerrado'].includes(item.estado)).length,
      preventive: prevention.filter(item => item.proyecto_nombre === name && isoDate(item.created_at) >= periodStart).length
    };
  });
  const bac = cards.reduce((sum,item)=>sum+item.bac,0), pv = cards.reduce((sum,item)=>sum+item.current.pv,0), ev = cards.reduce((sum,item)=>sum+item.current.ev,0), ac = cards.reduce((sum,item)=>sum+item.current.ac,0);
  const spi = ratio(ev,pv), cpi = ratio(ev,ac), sv = ev-pv, cv = ev-ac, eac = cpi && cpi > 0 ? bac/cpi : null;
  const scheduleVarianceDays = bac > 0 ? Math.round(cards.reduce((sum,item)=>sum+item.scheduleVarianceDays*item.bac,0)/bac) : 0;
  const totalReports = cards.reduce((sum,item)=>sum+item.reports,0), totalNc=cards.reduce((sum,item)=>sum+item.open,0);
  const todayIso = new Date().toISOString().slice(0,10);
  const milestones = planning.filter(item => selected.includes(item.obra_nombre) && Number(item.duracion) === 0);
  const overdueMilestones = milestones.filter(item => item.fecha_fin && item.fecha_fin < todayIso && number(item.porcentaje_avance) < 100).length;
  const upcomingMilestones = milestones.filter(item => item.fecha_fin && item.fecha_fin >= todayIso && item.fecha_fin <= new Date(Date.now() + 30 * day).toISOString().slice(0,10)).length;
  const equipmentIds = new Set(equipmentUse.map(item => item.equipo_id || item.equipo_patente).filter(Boolean));
  const equipmentHours = equipmentUse.reduce((sum,item)=>sum+number(item.horas_trabajadas),0);
  const openFailures = failures.filter(item=>!String(item.solucion || '').trim()).length;
  const assignedPersonnel = personnel.filter(item=>selected.includes(item.obra_nombre)).length;
  const unassignedPersonnel = personnel.filter(item=>!item.obra_nombre || ['Bodega','Sin asignar'].includes(item.obra_nombre)).length;
  const today = new Date();
  const openNc = nonConformities.filter(item=>!['Cerrada','Cerrado'].includes(item.estado));
  const overdueNc = openNc.filter(item=>isoDate(item.fecha_compromiso) && isoDate(item.fecha_compromiso) < today).length;
  const criticalNc = openNc.filter(item=>/cr[ií]tic|mayor|alta/i.test(String(item.clasificacion || ''))).length;
  const pendingEffectiveness = nonConformities.filter(item=>['Cerrada','Cerrado'].includes(item.estado) && item.eficacia_verificada !== true).length;
  const causeCounts = nonConformities.reduce((acc,item)=>{const cause=String(item.causa_categoria||'').trim();if(cause)acc[cause]=(acc[cause]||0)+1;return acc;},{});
  const recurringCauses = Object.entries(causeCounts).filter(([,count])=>count>1).sort((a,b)=>b[1]-a[1]);
  const incidentRecords = prevention.filter(item=>/incidente|accidente|casi accidente/.test(responseText(item.respuestas)));
  const accidentRecords = prevention.filter(item=>/accidente/.test(responseText(item.respuestas)) && !/casi accidente/.test(responseText(item.respuestas))).length;
  const lostDays = incidentRecords.reduce((sum,item)=>sum+responseNumber(item.respuestas,['dias_perdidos','días_perdidos','dias perdidos','días perdidos']),0);
  const aggregate = cards.length ? cards[0].points.map((point,index)=>({date:point.date,pv:cards.reduce((sum,item)=>sum+(item.points[index]?.pv||0),0),ev:cards.reduce((sum,item)=>sum+(item.points[index]?.ev||0),0),ac:cards.reduce((sum,item)=>sum+(item.points[index]?.ac||0),0)})) : [];
  const kpi = (label,value,detail,color='#17233b') => `<td style="width:25%;padding:7px"><div style="height:76px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px"><div style="font-size:20px;font-weight:800;color:${color}">${value}</div><div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px">${label}</div><div style="font-size:9px;color:#94a3b8;margin-top:4px">${detail}</div></div></td>`;
  const specialty = schedule.plantilla_codigo === 'maquinaria_general'
    ? `<h2 style="font-size:14px;margin:20px 8px 2px">Maquinaria y equipos</h2><table style="width:100%;border-spacing:7px"><tr>${kpi('Equipos con uso',equipmentIds.size,'Período informado')}${kpi('Horas registradas',equipmentHours.toFixed(1),'Utilización acumulada')}${kpi('Fallas abiertas',openFailures,'Requieren seguimiento',openFailures?'#be123c':'#047857')}${kpi('Mantenciones',maintenance.length,'Ejecutadas en el período')}</tr></table>`
    : schedule.plantilla_codigo === 'rrhh_general'
      ? `<h2 style="font-size:14px;margin:20px 8px 2px">Recursos humanos</h2><table style="width:100%;border-spacing:7px"><tr>${kpi('Personal asignado',assignedPersonnel,'En obras seleccionadas')}${kpi('Sin asignación',unassignedPersonnel,'Disponible / bodega',unassignedPersonnel?'#b45309':'#047857')}${kpi('Asistencias',cards.reduce((s,x)=>s+x.present,0),'Registros presentes')}${kpi('Cobertura',personnel.length?`${Math.round(assignedPersonnel/personnel.length*100)}%`:'N/D','Dotación asignada')}</tr></table>`
      : schedule.plantilla_codigo === 'calidad_general'
        ? `<h2 style="font-size:14px;margin:20px 8px 2px">Calidad</h2><table style="width:100%;border-spacing:7px"><tr>${kpi('NC abiertas',openNc.length,'Pendientes de cierre',openNc.length?'#be123c':'#047857')}${kpi('NC vencidas',overdueNc,'Compromiso incumplido',overdueNc?'#be123c':'#047857')}${kpi('Críticas / mayores',criticalNc,'Prioridad de intervención',criticalNc?'#be123c':'#047857')}${kpi('Eficacia pendiente',pendingEffectiveness,'Cierres por verificar',pendingEffectiveness?'#b45309':'#047857')}</tr></table>${recurringCauses.length?`<div style="margin:7px;padding:12px;background:#fff7ed;border-radius:10px;font-size:10px"><b>Causas recurrentes:</b> ${recurringCauses.slice(0,4).map(([cause,count])=>`${esc(cause)} (${count})`).join(' · ')}</div>`:''}`
        : schedule.plantilla_codigo === 'prevencion_general'
          ? `<h2 style="font-size:14px;margin:20px 8px 2px">Prevención</h2><table style="width:100%;border-spacing:7px"><tr>${kpi('Registros preventivos',prevention.length,'Actividad del período')}${kpi('Eventos reportados',incidentRecords.length,'Incidentes y accidentes',incidentRecords.length?'#b45309':'#047857')}${kpi('Accidentes',accidentRecords,'Clasificación inicial',accidentRecords?'#be123c':'#047857')}${kpi('Días perdidos',lostDays,'Informados en seguimiento',lostDays?'#be123c':'#047857')}</tr></table>`
      : '';
  const planningBlock = planning.length ? `<h2 style="font-size:14px;margin:20px 8px 2px">Programación e hitos</h2><table style="width:100%;border-spacing:7px"><tr>${kpi('Tareas programadas',planning.filter(item=>selected.includes(item.obra_nombre)).length,'Cronograma vinculado')}${kpi('Hitos',milestones.length,'Duración cero')}${kpi('Hitos vencidos',overdueMilestones,'Pendientes al corte',overdueMilestones?'#be123c':'#047857')}${kpi('Próximos hitos',upcomingMilestones,'Siguientes 30 días')}</tr></table>` : '';
  const suggestions=[spi!=null&&spi<.9&&`Activar plan de recuperación de plazo: el portafolio presenta ${Math.abs(scheduleVarianceDays)} días equivalentes de atraso.`,cpi!=null&&cpi<.9&&`Revisar productividad y compromisos de compra: el EAC proyectado alcanza ${money(eac)}.`,totalNc>0&&`Asignar responsables y fechas de cierre para ${totalNc} no conformidades abiertas.`,totalReports===0&&'Regularizar los reportes de avance: sin datos recientes el valor ganado pierde confiabilidad.',cards.some(item=>item.incompleteSchedule)&&'Completar fechas o rendimientos de las partidas para consolidar una línea base contractual confiable.',cards.reduce((s,x)=>s+x.preventive,0)===0&&'Revisar la actividad preventiva del período y confirmar que los registros asignados estén siendo utilizados.'].filter(Boolean);
  if(!suggestions.length)suggestions.push('Mantener el desempeño y concentrar la reunión en próximos hitos, restricciones y riesgos emergentes.');
  const html = `<div style="max-width:780px;margin:auto;background:#fff;border:1px solid #dbe3ef;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#17233b"><div style="padding:28px;background:#102b5c;color:#fff"><h1 style="margin:0 0 7px;font-size:25px">${esc(schedule.nombre)}</h1><div style="font-size:12px;color:#cbd5e1">${esc(company)} · Corte ${new Date().toLocaleDateString('es-CL')} · ${selected.length} obra(s)</div></div><div style="padding:20px"><table style="width:100%;border-collapse:collapse"><tr>${kpi('SPI',spi?.toFixed(2)??'N/D',state(spi),tone(spi))}${kpi('CPI',cpi?.toFixed(2)??'N/D',state(cpi),tone(cpi))}${kpi('Plazo equivalente',`${Math.abs(scheduleVarianceDays)} días`,scheduleVarianceDays<0?'Atraso':scheduleVarianceDays>0?'Adelanto':'En línea',scheduleVarianceDays<0?'#be123c':'#047857')}${kpi('Variación costo',money(cv),cv>=0?'Bajo presupuesto':'Sobrecosto',cv>=0?'#047857':'#be123c')}</tr><tr>${kpi('BAC',money(bac),'Presupuesto total')}${kpi('PV',money(pv),'Valor planificado')}${kpi('EV',money(ev),'Valor ganado')}${kpi('AC',money(ac),'Costo real')}</tr></table><div style="margin:16px 7px;padding:14px;border:1px solid #e2e8f0;border-radius:14px"><div style="display:flex;justify-content:space-between;align-items:center"><div><b style="font-size:14px">Curva S · Desempeño acumulado</b><div style="font-size:10px;color:#64748b">Planificado, valor ganado y costo real sobre una misma base económica</div></div><div style="font-size:10px;color:#64748b">EAC ${eac?money(eac):'N/D'}</div></div>${curveSvg(aggregate,bac)}</div><table style="width:100%;border-spacing:7px"><tr>${kpi('Reportes del período',totalReports,`${periodDays} días`)}${kpi('NC abiertas',totalNc,'Calidad',totalNc?'#be123c':'#047857')}${kpi('Asistencias',cards.reduce((s,x)=>s+x.present,0),'Registros presentes')}${kpi('Prevención',cards.reduce((s,x)=>s+x.preventive,0),'Registros del período')}</tr></table><h2 style="font-size:14px;margin:20px 8px 9px">Desempeño por obra</h2>${cards.map(item=>`<div style="margin:8px;padding:14px;border:1px solid #e2e8f0;border-radius:12px"><div style="display:flex;justify-content:space-between;gap:12px"><b>${esc(item.name)}</b><span style="font-size:10px;font-weight:800;color:${tone(Math.min(item.spi??0,item.cpi??0))}">SPI ${item.spi?.toFixed(2)??'N/D'} · CPI ${item.cpi?.toFixed(2)??'N/D'} · ${Math.abs(item.scheduleVarianceDays)} días ${item.scheduleVarianceDays<0?'atraso':item.scheduleVarianceDays>0?'adelanto':'en línea'}</span></div><table style="width:100%;margin-top:9px;font-size:10px;color:#475569"><tr><td>PV <b>${money(item.current.pv)}</b></td><td>EV <b>${money(item.current.ev)}</b></td><td>AC <b>${money(item.current.ac)}</b></td><td>NC <b>${item.open}</b></td></tr></table>${item.incompleteSchedule?'<div style="margin-top:8px;font-size:9px;color:#b45309">Cronograma incompleto: la proyección faltante se representa linealmente y debe regularizarse en Programación.</div>':''}</div>`).join('')}<div style="margin:17px 8px 3px;padding:15px;background:#fff7ed;border-left:5px solid #ea580c;border-radius:8px"><b style="font-size:12px">Sugerencias y decisiones recomendadas</b><ol style="margin:8px 0 0;padding-left:18px;font-size:12px;line-height:1.65">${suggestions.map(item=>`<li>${esc(item)}</li>`).join('')}</ol></div><div style="margin:10px 8px 0;font-size:9px;color:#94a3b8">Los días de adelanto o atraso corresponden a una estimación de Earned Schedule basada en la línea base disponible al corte.</div></div></div>`;
  const extraBlocks = `${planningBlock}${specialty}`;
  const enrichedHtml = extraBlocks ? html.replace('<h2 style="font-size:14px;margin:20px 8px 9px">Desempeño por obra</h2>', `${extraBlocks}<h2 style="font-size:14px;margin:20px 8px 9px">Desempeño por obra</h2>`) : html;
  return { html: enrichedHtml, indicators:{ obras:selected.length, reportes:totalReports, bac, pv, ev, ac, spi, cpi, sv, cv, eac, dias_desviacion:scheduleVarianceDays, tareas_programadas:planning.filter(item=>selected.includes(item.obra_nombre)).length, hitos:milestones.length, hitos_vencidos:overdueMilestones, hitos_proximos_30_dias:upcomingMilestones, nc_abiertas:totalNc, nc_vencidas:overdueNc, nc_criticas:criticalNc, eficacia_pendiente:pendingEffectiveness, causas_recurrentes:recurringCauses.slice(0,5), registros_prevencion:prevention.length, eventos_prevencion:incidentRecords.length, accidentes:accidentRecords, dias_perdidos:lostDays, equipos_con_uso:equipmentIds.size, horas_equipos:equipmentHours, fallas_abiertas:openFailures, mantenciones_periodo:maintenance.length, personal_asignado:assignedPersonnel, personal_sin_asignar:unassignedPersonnel }, cards };
}
