// Invoice-only calculations. Never write to movements, assignments or accounting.
// Quantities are millilitres; invoice money is whole CLP pesos, including signed IE.
export const DEFAULT_INVOICE_RULES = Object.freeze({machinery_threshold_milli:180000});
export const INVOICE_LITERS_TOLERANCE_MILLI = 20000;

function integer(value, label, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${label}: valor inválido`);
  return value;
}
function sum(values) {
  const total = values.reduce((a,b) => a + BigInt(b), 0n);
  const number = Number(total);
  if (!Number.isSafeInteger(number)) throw new Error('Total fuera de rango');
  return number;
}
export function validateInvoiceRules(rules = DEFAULT_INVOICE_RULES) {
  const threshold=integer(rules.machinery_threshold_milli,'Umbral de maquinaria',1);
  if(threshold>100000000)throw new Error('Umbral de maquinaria fuera de rango');
  return {machinery_threshold_milli:threshold};
}
export function classifyInvoiceMovement(litersMilli, rules = DEFAULT_INVOICE_RULES) {
  const {machinery_threshold_milli} = validateInvoiceRules(rules);
  return integer(litersMilli,'Litros originales',1) > machinery_threshold_milli ? 'maquinaria' : 'camioneta';
}

// Largest-remainder allocation: exact totals, deterministic ties by stable key,
// and symmetric treatment of credits/negative specific tax. No floating-point money.
export function allocateInvoiceTotal(total, items) {
  integer(total,'Importe',-Number.MAX_SAFE_INTEGER);
  if (!items.length) throw new Error('Sin base para distribuir');
  const keys = new Set();
  for (const item of items) {
    if (typeof item.key !== 'string' || !item.key || keys.has(item.key)) throw new Error('Clave de distribución repetida o vacía');
    keys.add(item.key);
    integer(item.weight,'Base de distribución',1);
  }
  const denominator = items.reduce((a,i) => a + BigInt(i.weight), 0n);
  const magnitude = BigInt(Math.abs(total));
  const parts = items.map(item => {
    const product = magnitude * BigInt(item.weight);
    return {key:item.key,amount:product/denominator,remainder:product%denominator};
  });
  const remainder = magnitude - parts.reduce((a,i) => a+i.amount,0n);
  const ranked = [...parts].sort((a,b) => a.remainder===b.remainder
    ? (a.key<b.key?-1:a.key>b.key?1:0) : (a.remainder>b.remainder?-1:1));
  for (let i=0;i<Number(remainder);i++) ranked[i].amount++;
  return new Map(parts.map(p=>[p.key,Number(p.amount)*(total<0?-1:1)]));
}

function validateInvoice(invoice) {
  if (!invoice?.empresa || !['empresa','transporte'].includes(invoice.portal)) throw new Error('Empresa y portal verificados requeridos');
  if (!/^\d{1,30}$/.test(invoice.document || '')) throw new Error('Número de factura inválido');
  if (!Array.isArray(invoice.guides) || !invoice.guides.length || invoice.guides.length>10000) throw new Error('Guías requeridas');
  if (invoice.guides.some(g=>typeof g!=='string'||!/^\d{1,30}$/.test(g))) throw new Error('Número de guía inválido');
  if (new Set(invoice.guides).size!==invoice.guides.length) throw new Error('Guía repetida en la factura; revisar extracción');
  integer(invoice.liters_milli,'Litros facturados',1);
  integer(invoice.fuel_net,'Neto combustible');
  integer(invoice.shellcard_net,'Cargo/descuento Shellcard',-Number.MAX_SAFE_INTEGER);
  integer(invoice.net,'Neto');
  integer(invoice.vat,'IVA');
  integer(invoice.specific_tax,'Impuesto específico',-Number.MAX_SAFE_INTEGER);
  integer(invoice.exempt,'Exento');
  integer(invoice.total,'Total');
  if (sum([invoice.fuel_net,invoice.shellcard_net])!==invoice.net) throw new Error('Neto combustible y Shellcard no cuadran con la factura');
  if (sum([invoice.net,invoice.vat,invoice.specific_tax,invoice.exempt])!==invoice.total) throw new Error('Los importes no cuadran con el total de la factura');
}

/** Pure draft reconciliation. Its successful result is NOT an accounting entry,
 * an issued document, or a claim that the source invoice has been authenticated.
 * Centers/works must come from the authorized company's existing catalogs.
 */
export function reconcileEnexInvoice({invoice,movements,centers,works=[],rules=DEFAULT_INVOICE_RULES}) {
  validateInvoice(invoice);
  const snapshotRules = validateInvoiceRules(rules);
  const problems = [];
  const matched = [];
  const company = invoice.empresa;
  for (const document of invoice.guides) {
    const candidates = movements.filter(m=>m.empresa===company&&m.portal===invoice.portal&&m.document===document);
    if (candidates.length!==1) {
      problems.push({document,code:candidates.length?'ambiguous':'missing',message:candidates.length?'Más de un movimiento coincide':'Guía sin movimiento'});
      continue;
    }
    const movement=candidates[0];
    integer(movement.liters_milli,'Litros del movimiento',1);
    if (!movement.id) throw new Error('Movimiento sin identificador');
    const assignment=movement.assignment;
    if (!assignment) {
      problems.push({document,code:'unassigned',message:'Movimiento pendiente de asignación'});
      continue;
    }
    if (assignment.empresa && assignment.empresa!==company) throw new Error('Asignación de otra empresa');
    const work=assignment.obra_id==null?null:works.find(w=>w.empresa===company&&String(w.id)===String(assignment.obra_id));
    if (assignment.obra_id!=null && !work) {
      problems.push({document,code:'invalid_work',message:'Obra de la asignación no disponible'});
      continue;
    }
    const centerId=assignment.centro_gestion_id ?? work?.centro_gestion_id;
    const center=centers.find(c=>c.empresa===company&&c.activo===true&&String(c.id)===String(centerId));
    if (!center || (work && String(work.centro_gestion_id)!==String(centerId))) {
      problems.push({document,code:'invalid_center',message:'Centro de gestión no disponible o incompatible con la obra'});
      continue;
    }
    matched.push({movement_id:movement.id,document,vehicle:movement.vehicle,center_id:center.id,
      center_code:center.codigo,center_name:center.nombre,original_liters_milli:movement.liters_milli,
      classification:classifyInvoiceMovement(movement.liters_milli,snapshotRules)});
  }
  // Missing loads cannot be explained away with the ±20 litre tolerance.
  if (problems.length) return {ready:false,problems,rules:snapshotRules,rows:[],groups:[]};
  matched.sort((a,b)=>a.movement_id<b.movement_id?-1:a.movement_id>b.movement_id?1:0);
  const originalLiters=sum(matched.map(m=>m.original_liters_milli));
  const difference=invoice.liters_milli-originalLiters;
  if (Math.abs(difference)>INVOICE_LITERS_TOLERANCE_MILLI) return {
    ready:false,problems:[{code:'liters_mismatch',message:'Desfase superior a ±20 litros'}],
    rules:snapshotRules,original_liters_milli:originalLiters,difference_milli:difference,rows:[],groups:[],
  };
  const weights=matched.map(m=>({key:m.movement_id,weight:m.original_liters_milli}));
  const quantities=allocateInvoiceTotal(invoice.liters_milli,weights);
  const moneyFields=['fuel_net','shellcard_net','vat','specific_tax','exempt'];
  const distributions=Object.fromEntries(moneyFields.map(k=>[k,allocateInvoiceTotal(invoice[k],weights)]));
  const rows=matched.map(m=>{
    const row={...m,adjusted_liters_milli:quantities.get(m.movement_id)};
    row.adjustment_milli=row.adjusted_liters_milli-row.original_liters_milli;
    for (const field of moneyFields) row[field]=distributions[field].get(m.movement_id);
    row.net=sum([row.fuel_net,row.shellcard_net]);
    row.total=sum([row.net,row.vat,row.specific_tax,row.exempt]);
    return row;
  });
  const groups=new Map();
  for (const row of rows) {
    const key=JSON.stringify([row.center_id,row.classification]);
    if (!groups.has(key)) groups.set(key,{center_id:row.center_id,center_code:row.center_code,
      center_name:row.center_name,classification:row.classification,documents:[],original_liters_milli:0,
      adjusted_liters_milli:0,adjustment_milli:0,fuel_net:0,shellcard_net:0,vat:0,specific_tax:0,exempt:0,net:0,total:0});
    const group=groups.get(key);
    group.documents.push(row.document);
    for(const field of ['original_liters_milli','adjusted_liters_milli','adjustment_milli',...moneyFields,'net','total']) group[field]=sum([group[field],row[field]]);
  }
  return {ready:true,problems:[],rules:snapshotRules,original_liters_milli:originalLiters,
    invoice_liters_milli:invoice.liters_milli,difference_milli:difference,rows,groups:[...groups.values()]};
}
