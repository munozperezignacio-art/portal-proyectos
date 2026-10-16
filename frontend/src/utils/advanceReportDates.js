export function advanceReportDay(report) {
  for(const value of [report.fecha,report.fecha_avance,report.created_at]){
    const day=String(value || '').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))continue;
    const time=Date.parse(`${day}T12:00:00Z`);
    if(Number.isFinite(time) && new Date(time).toISOString().slice(0,10)===day)return day;
  }
  return '';
}
export const advanceReportDateLabel=report=>{
  const day=advanceReportDay(report);
  return day?day.split('-').reverse().join('-'):'Sin fecha';
};
export function filterAdvanceReports(reports,{date='',order='desc'}={}) {
  return reports.filter(report=>!date || advanceReportDay(report)===date).slice().sort((a,b)=>{
    const first=advanceReportDay(a),second=advanceReportDay(b);
    if(!first || !second)return first?-1:second?1:0;
    const byDay=first.localeCompare(second)*(order==='asc'?1:-1);
    return byDay || String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(b.id || '').localeCompare(String(a.id || ''),undefined,{numeric:true});
  });
}
