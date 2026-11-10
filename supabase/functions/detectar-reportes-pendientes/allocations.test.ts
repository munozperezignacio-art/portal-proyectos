import {allocationNotices,types} from './allocations.ts';
for(const code of Object.keys(types)){
 const rows:any={obras:[{id:1,nombre:'A'}],usuarios:[{id:7,rol:'Admin',obras:'A'}],notificaciones_entregas:[],costos_reales_obra:[{id:1,fecha_costo:'2026-11-10',imputaciones:[],monto:10}],obra_periodo_cargos:null,rrhh_costos_personal_vigentes:[{id:1,fecha:'2026-11-10',version_imputacion:0,obra_liquidaciones_partidas:[]}],maquinaria_periodos_costo:[{id:1,equipo_id:1,obra_id:1,desde:'2026-11-10',tarifa:10}],maquinaria_uso_diario:[],maquinaria_decisiones_costo:[],maquinaria_partidas_decisiones:[]};
 const sent:any[]=[];const db={from:(name:string)=>{const q:any={};for(const m of ['select','eq','gt','order','contains','lte'])q[m]=()=>q;q.range=()=>Promise.resolve({data:rows[name]});q.maybeSingle=()=>Promise.resolve({data:rows[name]});q.then=(resolve:any)=>resolve({data:rows[name]});q.upsert=(r:any)=>{sent.push(...r);rows.notificaciones_entregas=r;return Promise.resolve({error:null})};return q;}};
 const rule={id:1,empresa:'test',evento_codigo:code,canal_plataforma:true,destinatarios_usuarios:['7']};
 await allocationNotices(db,rule,'2026-11-10');await allocationNotices(db,rule,'2026-11-10');
 if(sent.length!==1||sent[0].payload.cantidad!==1)throw Error(code+' failed');
 console.log(code+': una notificación, segunda ejecución sin repetición');
}
