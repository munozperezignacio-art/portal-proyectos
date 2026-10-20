import {equipmentSimulationTemplate,simulationDate,validSimulationDate} from './projectSimulator.js';
const text=value=>String(value??'').trim();
const rutKey=value=>text(value).replace(/[^0-9kK]/g,'').toUpperCase();
const companyKey=row=>text(row.empresa);
const isLabor=row=>row.categoria_proyeccion==='Mano de obra'||['Provisión aprobada','Nómina conciliada'].includes(row.fuente);
const dateOf=row=>simulationDate(row.fecha||row.created_at);
const amountOf=row=>{
  const raw=row.monto??row.monto_real;
  return raw==null||raw===''||!Number.isFinite(Number(raw))?null:Number(raw);
};
const rowIdentity=row=>JSON.stringify([companyKey(row),row.categoria_proyeccion||'Costo real',row.id==null?null:String(row.id),...(row.id==null?[row.nombre,row.trabajador,row.trabajador_nombre,row.trabajador_id,row.trabajador_rut||row.rut,row.fecha,row.created_at,row.monto??row.monto_real,row.num_factura,row.proveedor_rut,row.centro_gestion_id]:[])]);

// The selector is a resource catalog, not a ledger. Source rows remain untouched.
export function simulationResourceTemplates(costs=[],equipment=[],cutoff=''){
  const rows=costs.filter(row=>!cutoff||!validSimulationDate(dateOf(row))||dateOf(row)<=cutoff);
  const aliases=new Map();
  for(const row of rows.filter(isLabor)){
    const rut=rutKey(row.trabajador_rut||row.rut);
    if(rut&&row.trabajador_id!=null){const key=JSON.stringify([companyKey(row),rut]);const ids=aliases.get(key)||new Set();ids.add(String(row.trabajador_id));aliases.set(key,ids);}
  }
  const groups=new Map(),templates=[],seen=new Set(),occurrences=new Map();
  for(const row of rows){
    const identity=rowIdentity(row);
    // Only a real record ID proves that two source rows are the same charge.
    if(row.id!=null&&seen.has(identity))continue;
    if(row.id!=null)seen.add(identity);
    const occurrence=occurrences.get(identity)||0;occurrences.set(identity,occurrence+1);
    const recordKey=row.id==null?`${identity}:${occurrence}`:identity;
    if(!isLabor(row)){
      const sourceId=`cost-${recordKey}`;
      if(templates.some(t=>t.sourceId===sourceId))continue;
      templates.push({sourceId,name:row.nombre||row.trabajador||row.categoria_proyeccion||'Costo sin nombre',rate:amountOf(row)??'',quantity:1,mode:'fixed',source:'Referencia histórica: importe copiado como nuevo gasto futuro, no como costo diario',untilFinish:true});continue;
    }
    const rut=rutKey(row.trabajador_rut||row.rut),alias=aliases.get(JSON.stringify([companyKey(row),rut]));
    const id=row.trabajador_id!=null?String(row.trabajador_id):alias?.size===1?[...alias][0]:null;
    // Never merge homonyms using name alone. Legacy unidentified charges remain explicit.
    const key=JSON.stringify([companyKey(row),id!=null?'id':rut?'rut':'registro',id??(rut||recordKey)]);
    const group=groups.get(key)||{sourceId:`labor-${key}`,workerId:id,rut:row.trabajador_rut||row.rut||'',history:[]};
    group.history.push({id:row.id??identity,name:row.trabajador||row.trabajador_nombre||row.nombre||'Trabajador sin nombre',date:dateOf(row),amount:amountOf(row),source:row.fuente||'Registro histórico',daily:validSimulationDate(simulationDate(row.fecha))&&['Provisión aprobada','Nómina conciliada'].includes(row.fuente)});
    groups.set(key,group);
  }
  for(const group of groups.values()){
    group.history.sort((a,b)=>b.date.localeCompare(a.date)||String(a.id).localeCompare(String(b.id))||a.name.localeCompare(b.name));
    const days=new Map();
    for(const row of group.history.filter(r=>r.daily&&r.amount!=null))days.set(row.date,(days.get(row.date)||0)+row.amount);
    const recentDays=[...days].sort(([a],[b])=>b.localeCompare(a)).slice(0,5);
    const average=recentDays.length?Math.round(recentDays.reduce((sum,[,amount])=>sum+amount,0)/recentDays.length):null;
    templates.push({...group,name:group.history[0].name,rate:average!=null&&average>=0?average:'',quantity:1,mode:'workday',untilFinish:true,
      referenceDates:recentDays.map(([date])=>date),
      source:recentDays.length?`Referencia diaria: promedio de las últimas ${recentDays.length} jornadas con costo registrado. Incluye HE y haberes de esos días; tarifa editable.`:'Sin referencia diaria comprobable. Ingresa la tarifa; un total mensual no se usa como costo de un día.'});
  }
  for(const [index,item] of equipment.entries()){
    const template=equipmentSimulationTemplate(item,index);
    if(!templates.some(t=>t.sourceId===template.sourceId))templates.push(template);
  }
  return templates.sort((a,b)=>a.name.localeCompare(b.name,'es')||a.sourceId.localeCompare(b.sourceId));
}
