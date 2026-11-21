import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import PayrollAutomation from '../../src/components/PayrollAutomation';
import {supabase} from '../../src/supabaseClient';
import '../../src/index.css';
const period=new Date().toISOString().slice(0,7);
const worker={id:1,nombre:'Persona de prueba',rut:'1-9',empresa:'TEST',sueldo_base:600000,gratificacion:'Sin Gratificación',otras_asignaciones:[{nombre:'Bono',monto:200000,tipo:'no_imponible',desde:period,calculo:'marcajes'}]};
let header=JSON.parse(localStorage.getItem('test-payroll-header')||'null'),items=JSON.parse(localStorage.getItem('test-payroll-items')||'[]');
supabase.rpc=async()=>({data:{distribuida:true},error:null});
supabase.from=table=>{
 let operation='read';
 const result=()=>({data:table==='rrhh_costeo_automatico_empresas'?null:table==='rrhh_nominas_mensuales'?header?{...header,rrhh_nomina_items:items}:null:table==='rrhh_costeo_parametros'?{periodo:period,horas_semanales:42}:table==='asistencia_personal'?localStorage.getItem('test-no-marks')?[]:['01','02','02'].map(day=>({rut:'19',fecha_marcacion:period+'-'+day,asistencia:'PRESENTE'})):[],error:null});
 const q={select:()=>q,eq:()=>q,gte:()=>q,lte:()=>q,order:()=>q,range:async()=>result(),maybeSingle:async()=>result(),single:async()=>result(),
 upsert(value){header={...value,id:1};localStorage.setItem('test-payroll-header',JSON.stringify(header));return q;},
 delete(){operation='delete';return q;},
 insert:async value=>{items=value;localStorage.setItem('test-payroll-items',JSON.stringify(items));return {error:null};},
 then(resolve){resolve(operation==='delete'?{error:null}:result());}
 };return q;
};
function Fixture(){const [emitted,emit]=useState(null);return <main className="p-4"><PayrollAutomation user={{empresa:'TEST',nombre:'Prueba'}} personal={[worker]} indicadores={{}} onEmit={emit}/>{emitted&&<output data-testid="liquidation">{JSON.stringify(emitted.payroll.allowances)}</output>}</main>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
