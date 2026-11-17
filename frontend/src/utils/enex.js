// No network, credentials or accounting writes in this module.
export const CSV_HEADER = 'portal,fecha_hora_local,patente_visible,gd_boleta,litros,monto_con_signo';
export const CSV_STATION_HEADER = CSV_HEADER+',estacion,comuna';
function csvColumns(line) {
  const cells=[]; let cell='',quoted=false,closed=false;
  for(let i=0;i<line.length;i++) {
    const c=line[i];
    if(quoted){if(c==='"'){if(line[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
    else if(c===','){cells.push(cell);cell='';closed=false;}
    else if(c==='"'&&!cell&&!closed)quoted=true;
    else {if(closed||c==='"')throw Error('CSV inválido');cell+=c;}
  }
  if(quoted)throw Error('CSV inválido'); cells.push(cell);return cells;
}
const text = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value && !Array.from(value).some(char=>char.charCodeAt(0)<32);
export function validateMovement(row) {
  if (!['transporte','empresa'].includes(row.portal) || !text(row.vehicle, 40) || !/^\d{1,30}$/.test(row.document)) throw Error('Identificador o portal inválido');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.occurred_local)) throw Error('Fecha local inválida');
  const date = new Date(row.occurred_local.replace(' ','T') + 'Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,19).replace('T',' ') !== row.occurred_local) throw Error('Fecha local inválida');
  if (!Number.isSafeInteger(row.liters_milli) || row.liters_milli <= 0 || row.liters_milli > 100000000 || !Number.isSafeInteger(row.amount_signed) || row.amount_signed >= 0 || row.amount_signed < -1000000000) throw Error('Carga con litros o débito inválido');
  if (row.kind !== 'Carga') throw Error('Este importador acepta solo cargas verificadas; otros movimientos requieren revisión');
  const metadata={};
  for(const [key,max] of [['station',250],['station_commune',120]]) {
    if(row[key]!=null) { if(!text(row[key],max))throw Error('Estación o comuna inválida'); metadata[key]=row[key]; }
  }
  return {portal:row.portal,occurred_local:row.occurred_local,vehicle:row.vehicle,document:row.document,liters_milli:row.liters_milli,amount_signed:row.amount_signed,kind:'Carga',...metadata};
}
export function parseEnexCsv(csv) {
  if (typeof csv !== 'string' || csv.length > 1000000) throw Error('Archivo demasiado grande');
  const lines = csv.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trimEnd().split('\n');
  const header=lines.shift(),withStation=header===CSV_STATION_HEADER;
  if ((!withStation&&header!==CSV_HEADER) || !lines.length || lines.length > 1000) throw Error('Formato o cantidad de filas inválidos');
  return lines.map(line => {
    const columns=csvColumns(line);
    if(columns.length!==(withStation?8:6)) throw Error('Cantidad de columnas inválida');
    const [portal,occurred_local,vehicle,document,liters,amount,station,station_commune]=columns;
    if(!/^\d{1,6}\.\d{3}$/.test(liters) || !/^-\d{1,10}$/.test(amount)) throw Error('Número inválido');
    return validateMovement({portal,occurred_local,vehicle,document,liters_milli:Number(liters.replace('.','')),amount_signed:Number(amount),kind:'Carga',...(station?{station}:{}),...(station_commune?{station_commune}:{})});
  });
}
export const movementKey = (company,row) => JSON.stringify([company,row.portal,row.document]);
const corePayload = row => { const {station,station_commune,...core}=validateMovement(row); return JSON.stringify(core); };
export function planImport(company, incoming, existing=[]) {
  if(!text(company,160)) throw Error('Empresa requerida');
  if(existing.some(row=>row.empresa && row.empresa!==company))throw Error('Empresa inesperada');
  const index=new Map(),metadataIndex=new Map(); const added=[]; let repeated=0;
  for(const row of existing) {
    const key=movementKey(company,row), payload=corePayload(row);
    if(index.has(key) && index.get(key)!==payload)throw Error('Conflicto en registros existentes');
    index.set(key,payload);
    metadataIndex.set(key,row);
  }
  for(const raw of incoming) {
    const row=validateMovement(raw), key=movementKey(company,row), payload=corePayload(row);
    const prior=metadataIndex.get(key);
    if(prior&&['station','station_commune'].some(k=>prior[k]!=null&&row[k]!=null&&prior[k]!==row[k]))throw Error('Conflicto en estación de servicio');
    if(index.has(key)) { if(index.get(key)!==payload) throw Error('Conflicto: mismo identificador con contenido diferente'); repeated++; }
    else { index.set(key,payload); added.push(row); }
    metadataIndex.set(key,{...prior,...row});
  }
  return {added,repeated};
}
export function summarize(rows) {
  let liters_milli=0,amount_signed=0;
  for(const row of rows) { validateMovement(row); liters_milli+=row.liters_milli; amount_signed+=row.amount_signed; }
  if(!Number.isSafeInteger(liters_milli)||!Number.isSafeInteger(amount_signed))throw Error('Total fuera de rango');
  return {count:rows.length,liters_milli,amount_signed,pending:rows.filter(r=>!r.assignment).length};
}
export function summaryText(company, rows, updatedAt) {
  const s=summarize(rows);
  const dates=rows.map(r=>r.occurred_local).sort();
  return `Resumen de combustible — ${company}\nFechas de movimientos visibles: ${dates[0]||'sin registros'} a ${dates.at(-1)||'sin registros'} (hora local del portal).\n${s.count} cargas; ${(s.liters_milli/1000).toLocaleString('es-CL',{minimumFractionDigits:3})} litros.\nDébitos del portal: $${Math.abs(s.amount_signed).toLocaleString('es-CL')} (signo original negativo). Moneda ISO y desglose tributario pendientes de confirmar; no corresponde a costo neto contabilizado.\nPendientes de asignación: ${s.pending}.\nAlertas: no evaluadas; no hay reglas configuradas.\nActualización verificada: ${updatedAt}.\nNo se han modificado tarjetas ni contabilizado costos.`;
}

// Component-instance protection only. Database uniqueness handles cross-client duplication.
export function createOperationGate() {
 let running=false;
 return {enter(){if(running)return false;running=true;return true;},leave(){running=false;}};
}
