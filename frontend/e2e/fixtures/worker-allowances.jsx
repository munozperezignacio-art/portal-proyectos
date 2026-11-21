import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import WorkerAllowancesEditor from '../../src/components/WorkerAllowancesEditor';
import {validateAllowances,allowanceTotals} from '../../src/utils/workerAllowances';
import '../../src/index.css';
function Fixture(){
 const [rows,setRows]=useState(()=>JSON.parse(localStorage.getItem('allowance-test')||'null')||[{nombre:'Bono Trato',monto:200000,tipo:'no_imponible',desde:'2026-11',hasta:''}]);
 const [saved,setSaved]=useState(false);
 return <main className="mx-auto max-w-3xl p-4"><form onSubmit={e=>{e.preventDefault();localStorage.setItem('allowance-test',JSON.stringify(validateAllowances(rows)));setSaved(true);}}><WorkerAllowancesEditor value={rows} onChange={setRows}/><button className="rounded-xl bg-blue-900 text-white p-3 mt-4">Guardar ficha</button>{saved&&<p role="status">Guardado</p>}</form><output>Con 15 días trabajados: {allowanceTotals({otras_asignaciones:rows},'2026-11',30,15).nonTaxable}</output></main>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
