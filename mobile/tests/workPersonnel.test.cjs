const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function load(name){const m={exports:{}};new Function('exports','module','require',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m,n=>load(n.replace('./','')));return m.exports;}
const {assignedWorkPersonnel,loadPersonnelSources}=load('workPersonnel');
const {parseOtherAttendanceHours,buildManualAttendanceBatch}=load('attendanceBatch');
const {validInputDate,calendarCells,calendarMonth}=load('dateInput');
const work={empresa:'TEST',nombre:'Obra A',centro_gestion_id:25};
const workers=[{id:1,empresa:'TEST',nombre:'Ana',rut:'1-9',obra_nombre:'Obra A',fecha_asig:'2026-10-01'},{id:2,empresa:'TEST',nombre:'Luis',rut:'2-7',obra_nombre:'Obra B'},{id:3,empresa:'OTHER',nombre:'Ajeno',rut:'3-5',obra_nombre:'Obra A'},{id:4,empresa:'TEST',nombre:'Trasladado',rut:'4-3',obra_nombre:'Obra B',fecha_asig:'2026-10-20'},{id:5,empresa:'TEST',nombre:'Futuro',rut:'5-1',obra_nombre:'Obra A',fecha_asig:'2026-11-01'}];
const sources={workers,links:[{empresa:'TEST',trabajador_id:2,centro_gestion_id:25,centro_activo:true,fecha_inicio:'2026-10-01',fecha_termino:'2026-10-31'}],assignments:[{empresa:'TEST',trabajador_id:4,obra_nombre:'Obra A',fecha_inicio:'2026-10-01',fecha_termino:'2026-10-19'},{empresa:'TEST',trabajador_id:4,obra_nombre:'Obra B',fecha_inicio:'2026-10-20'}]};
assert.deepEqual(assignedWorkPersonnel(sources,work,'2026-10-21').map(w=>w.id),[1,2]);
assert.deepEqual(assignedWorkPersonnel(sources,work,'2026-10-19').map(w=>w.id),[1,2,4]);
assert.deepEqual(assignedWorkPersonnel({...sources,links:[{...sources.links[0],centro_activo:false}]},work,'2026-10-21').map(w=>w.id),[1]);
assert.equal(assignedWorkPersonnel({...sources,workers:[...workers,{...workers[0],id:6,rut:'1.9'}]},work,'2026-10-21').length,2);
assert.equal(assignedWorkPersonnel({...sources,workers:[{...workers[1],fecha_vencimiento_contrato:'2026-10-20'}]},work,'2026-10-21').length,0);
for(const [input,expected] of [['',0],['2,5',2.5],['1.25',1.25],[0,0]])assert.equal(parseOtherAttendanceHours(input),expected);
for(const input of ['-1','abc','2.555',Infinity,'100000000'])assert.throws(()=>parseOtherAttendanceHours(input));
const payload=buildManualAttendanceBatch({empresa:'TEST',otras_horas:'2,5',horas_extras_auto:1,horas_ordinarias:8},[workers[0]]);assert.equal(payload[0].otras_horas,2.5);assert.equal(payload[0].horas_extras_auto,1);assert.equal(payload[0].horas_ordinarias,8);
assert.equal(validInputDate('2024-02-29'),true);assert.equal(validInputDate('2026-02-29'),false);assert.equal(validInputDate('2026-02-31'),false);
const feb=calendarCells(calendarMonth('2024-02-10'));assert.equal(feb.filter(Boolean).length,29);assert.equal(feb.filter(Boolean).at(-1),'2024-02-29');assert.equal(feb.indexOf('2024-02-01'),3);
(async()=>{const queries=[];const client={from(table){const q={table};queries.push(q);const chain={select(columns){q.columns=columns;return chain},eq(col,val){q.filter=[col,val];return chain},order(){return chain},async range(){return {data:[],error:null}}};return chain;}};await loadPersonnelSources(client,'TEST');assert.equal(queries.length,3);assert.ok(queries.every(q=>q.filter[0]==='empresa'&&q.filter[1]==='TEST'));console.log('Passed mobile attendance: direct and additional assignments, dates and transfers, isolation, duplicate RUTs, independent other hours, calendar leap days, company-scoped queries.');})().catch(e=>{console.error(e);process.exitCode=1});
