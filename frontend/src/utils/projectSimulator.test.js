import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateProject,seedSimulationParts,equipmentSimulationTemplate,simulationDates} from './projectSimulator.js';
const part={id:'1',name:'Pilas',unit:'UND',remaining:50,pace:10,start:'2026-10-20'};
const base={cutoff:'2026-10-19',start:'2026-10-20',end:'2026-11-30',deadline:'2026-10-30',weekdays:[1,2,3,4,5],parts:[part],actualCost:1000};
const resource=(id,mode,rate=100,extra={})=>({id,name:id,mode,rate,quantity:1,start:'2026-10-20',end:'',untilFinish:true,...extra});

test('work baseline loads without manual selections, preserves ledger dates and reconciles history once',()=>{
 const input={...base,historicalCosts:[{fecha:'2026-10-19',trabajador:'Personal',monto:1000}],remainingOtherCost:900,
 baseCosts:[{fecha:'2026-10-20',monto:200,equipo_patente:'EXC-01',categoria_proyeccion:'Uso diario de maquinaria'},
 {fecha:'2026-10-22',monto:200,equipo_patente:'EXC-01',categoria_proyeccion:'Uso diario de maquinaria'},
 {fecha:'2026-10-21',monto:300,nombre:'Personal futuro',categoria_proyeccion:'Mano de obra'},
 {fecha:'2026-10-27',monto:999,nombre:'Después del término'}]};
 const r=simulateProject(input);
 assert.equal(r.futureCost,1300);assert.equal(r.totalAtFinish,2300);
 assert.equal(r.days.find(d=>d.date==='2026-10-19').cost,1000);
 assert.equal(r.days.find(d=>d.date==='2026-10-21').charges.some(c=>c.name==='EXC-01'),false);
 assert.equal(r.days.find(d=>d.date==='2026-10-24').cost,0);
 assert.equal(r.days.find(d=>d.date==='2026-10-27').cost,0);
 assert.equal(r.resources.find(r=>r.id==='base-estimate').total,600);
 assert.equal(r.months.reduce((s,m)=>s+m.cost,0),r.futureCost);
 assert.equal(r.calendarMonths.reduce((s,m)=>s+m.cost,0),2300);
 for(const item of r.resources)assert.equal(r.days.filter(d=>!d.historical).flatMap(d=>d.charges).filter(c=>c.resourceId===item.id).reduce((s,c)=>s+c.amount,0),item.total);
 assert.equal(simulateProject({...input,resources:[resource('Extra','fixed',50)]}).futureCost,1350);
 assert.throws(()=>simulateProject({...input,baseCosts:[{fecha:'2026-10-20',monto:null}]}),/No se considera cero/);
});
test('daily cost breakdown reconciles all charging modes, resources and monthly totals',()=>{
 const resources=['fixed','workday','calendar','hour','month22','month30','units'].map((mode,i)=>resource(mode,mode,101+i,{partId:mode==='units'?'1':'',quantity:2}));
 const r=simulateProject({...base,resources});
 for(const day of r.days)assert.equal(day.charges.reduce((s,c)=>s+c.amount,0),day.cost);
 for(const item of r.resources)assert.equal(r.days.flatMap(d=>d.charges).filter(c=>c.resourceId===item.id).reduce((s,c)=>s+c.amount,0),item.total);
 const saturday=r.days.find(d=>d.date==='2026-10-24');
 assert.deepEqual(saturday.charges.map(c=>c.mode),['calendar','month30']);
 assert.equal(r.days.find(d=>d.date==='2026-10-27').charges.length,0);
 assert.equal(r.months.reduce((s,m)=>s+m.cost,0),r.days.reduce((s,d)=>s+d.cost,0));
});
test('fecha de término por producción pendiente y calendario; reales contados una sola vez',()=>{
  const r=simulateProject({...base,resources:[resource('Equipo','workday'),resource('Arriendo','calendar'),resource('Compra','fixed',500)]});
  assert.equal(r.finish,'2026-10-26');assert.equal(r.futureCost,1700);assert.equal(r.totalAtFinish,2700);
  assert.equal(r.parts[0].requiredPace,50/9);assert.equal(r.delayDays,-4);
  assert.equal(r.days.reduce((s,d)=>s+d.cost,0),r.futureCost);assert.equal(r.months.reduce((s,m)=>s+m.cost,0),r.futureCost);
});
test('feriado, trabajo excepcional y rendimiento diario reemplazan la base; cero es cero',()=>{
  const input={...base,holidays:['2026-10-20'],calendar:{'2026-10-24':true},parts:[{...part,remaining:30,overrides:{'2026-10-21':0,'2026-10-22':5,'2026-10-24':25}}]};
  const r=simulateProject(input);assert.equal(r.finish,'2026-10-24');
  assert.equal(r.days[0].production['1'],0);assert.equal(r.days[1].production['1'],0);assert.equal(r.days[2].production['1'],5);
  assert.equal(r.days.find(d=>d.date==='2026-10-24').production['1'],15);
  assert.equal(simulateProject({...input,calendar:{}}).finish,'2026-10-27');
});
test('horizonte incompleto y rendimiento cero no inventan término ni costo final',()=>{
  const r=simulateProject({...base,end:'2026-10-21',deadline:'2026-10-21',parts:[{...part,pace:0}],resources:[resource('Arriendo','calendar')]});
  assert.equal(r.finish,null);assert.equal(r.totalAtFinish,null);assert.equal(r.parts[0].remaining,50);assert.equal(r.futureCost,200);assert.match(r.warnings.join(' '),/solo el período/);
});
test('recursos vinculados a partida, cobro por unidad y días inclusivos, sin mezclar unidades',()=>{
  const r=simulateProject({...base,parts:[{...part,remaining:15},{...part,id:'2',name:'Hormigón',unit:'M3'}],resources:[resource('Equipo','workday',100,{partId:'1'}),resource('Material','units',20,{partId:'1',quantity:2}),resource('Compra','fixed',7,{start:'2026-10-24'})]});
  assert.equal(r.finish,'2026-10-26');assert.equal(r.resources.find(r=>r.id==='Equipo').total,200);assert.equal(r.resources.find(r=>r.id==='Material').total,600);assert.equal(r.resources.find(r=>r.id==='Compra').total,7);
  assert.throws(()=>simulateProject({...base,resources:[resource('Material','units')]}),/Vincula/);
});
test('horas, mensual/22, mensual/30 y recurso que permanece después del término',()=>{
  const r=simulateProject({...base,parts:[{...part,remaining:10}],resources:[resource('Horas','hour',20,{quantity:8}),resource('Mes22','month22',2200),resource('Mes30','month30',3000),resource('Sigue','calendar',1,{untilFinish:false,end:'2026-10-22'})]});
  assert.equal(r.finish,'2026-10-20');assert.equal(r.futureCost,363);assert.equal(r.resources.find(r=>r.id==='Sigue').total,3);
});
test('costos reales no disponibles bloquean solo total consolidado; cobertura parcial advertida',()=>{
  const r=simulateProject({...base,costError:'Error',resources:[resource('Equipo','workday')]});assert.equal(r.actualCost,null);assert.equal(r.totalAtFinish,null);assert.equal(r.futureCost,500);
  assert.match(simulateProject(base).warnings.join(' '),/No hay costos futuros cargados/);
  assert.match(simulateProject({...base,start:'2026-10-22'}).warnings.join(' '),/intervalo/);
});
test('fechas, negativos, vacíos, unidades y horizontes inválidos se rechazan',()=>{
  assert.equal(simulationDates('2024-02-28','2024-03-01').length,3);
  for(const start of ['2026-10-19','2026-02-30',''])assert.throws(()=>simulateProject({...base,start}));
  assert.throws(()=>simulationDates('2026-01-01','2040-01-01'),/3 años/);
  assert.throws(()=>simulateProject({...base,parts:[{...part,pace:-1}]}),/rendimiento/);
  assert.throws(()=>simulateProject({...base,resources:[resource('Sin tarifa','workday','')]}),/tarifa/);
  assert.throws(()=>simulateProject({...base,resources:[resource('Infinito','workday',Infinity)]}),/tarifa/);
  assert.throws(()=>simulateProject({...base,deadline:'2027-01-01'}),/Amplía/);
  assert.throws(()=>simulateProject({...base,parts:[{...part,quantity:0}]}),/sin cantidad objetivo/);
});
test('insumos decimales y redondeo CLP concilian días, meses y recursos exactamente',()=>{
  const r=simulateProject({...base,parts:[{...part,remaining:1000,pace:33.33}],resources:[resource('A','workday',0.49),resource('B','calendar',30.6),resource('C','units',0.7,{partId:'1'})]});
  assert.equal(r.days.reduce((s,d)=>s+d.cost,0),r.futureCost);assert.equal(r.months.reduce((s,m)=>s+m.cost,0),r.futureCost);assert.equal(r.resources.reduce((s,r)=>s+r.total,0),r.futureCost);assert.ok(Math.abs(r.parts[0].remaining-.1)<1e-8);assert.equal(r.finish,null);
});
test('semilla usa ID de partida, corte histórico y meta pendiente sin informes futuros',()=>{
  const parts=[{id:1,partida:'Pilas',unidad:'UND',quantity:100},{id:2,partida:'Título',unidad:'TITULO'}];
  const reports=[{partida_id:1,cantidad:20,fecha:'2026-10-19'},{partida_id:1,cantidad:99,fecha:'2026-10-20'},{partida_id:99,partida:'Pilas',cantidad:88,fecha:'2026-10-19'}];
  const seeded=seedSimulationParts(parts,reports,base.cutoff,base.deadline);
  assert.equal(seeded.length,1);assert.equal(seeded[0].remaining,80);assert.equal(seeded[0].completed,20);assert.equal(seeded[0].start,base.start);
});
test('equipos no convierten tarifa mensual a diaria ni inventan horas; entradas no se mutan',()=>{
  const item={tipo:'Excavadora',patente:'EXC-01',costo_interno:2200000,unidad_costo_interno:'$/mes'};
  const t=equipmentSimulationTemplate(item);assert.equal(t.mode,'month30');assert.equal(t.rate,2200000);
  const h=equipmentSimulationTemplate({costo:500,unidad_costo:'$/hora'});assert.equal(h.quantity,'');assert.equal(h.mode,'hour');
  const snapshot=JSON.stringify(base);simulateProject(base);assert.equal(JSON.stringify(base),snapshot);
});
test('dependencias fin-inicio respetan calendario y orden inverso; recursos esperan inicio efectivo',()=>{
 const r=simulateProject({...base,parts:[{...part,id:'2',name:'Sucesora',remaining:10,predecessors:['1']},{...part,remaining:20}],resources:[resource('Equipo','workday',100,{partId:'2'})]});
 assert.equal(r.parts.find(p=>p.id==='1').finish,'2026-10-21');
 assert.equal(r.parts.find(p=>p.id==='2').actualStart,'2026-10-22');
 assert.equal(r.finish,'2026-10-22');
 assert.equal(r.futureCost,100);
 assert.equal(r.parts[0].availableDays,7);
});
test('ciclos y referencias inexistentes se rechazan, predecesora detenida bloquea sucesora',()=>{
 assert.throws(()=>simulateProject({...base,parts:[{...part,predecessors:['1']}]}),/ciclo/);
 assert.throws(()=>simulateProject({...base,parts:[{...part,predecessors:['missing']}]}),/alcance/);
 const r=simulateProject({...base,parts:[{...part,pace:0},{...part,id:'2',predecessors:['1']}],resources:[resource('Equipo','calendar',100,{partId:'2'})]});
 assert.equal(r.finish,null);assert.equal(r.parts[1].actualStart,null);assert.equal(r.parts[1].availableDays,0);assert.equal(r.futureCost,0);
});
