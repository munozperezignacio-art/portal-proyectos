import React from 'react';
import {createRoot} from 'react-dom/client';
import FormulariosCapacitaciones from '../../src/components/FormulariosCapacitaciones';
import {supabase} from '../../src/supabaseClient';
import '../../src/index.css';
const original={id:123,empresa:'TEST',titulo:'Inspección de equipo',categoria:'maquinaria',publico_token:'ENLACE_INTACTO',campos:{control_documental:{codigo:'TEST-01',revision:'1',fecha_revision:'2026-11-21',todas_las_obras:true},items:[{id:'name',type:'text',label:'Nombre',required:true,options:[]},{id:'date',type:'date',label:'Fecha',required:false,options:[]},...[1,2].map(n=>({id:'matrix-'+n,type:'radio',label:'MÁSTIL · Pregunta '+n,required:true,options:['Bueno','Regular','Malo']}))]}};
window.designerWrites=[];window.designerOriginal=structuredClone(original);
supabase.from=table=>{const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,update(value){window.designerWrites.push({table,value});return q;},then(resolve){resolve({data:table==='prevencion_formularios'?[original]:[],error:null});}};return q;};
createRoot(document.getElementById('root')).render(<FormulariosCapacitaciones user={{empresa:'TEST',_rolePreview:true,permisos:{'formularios.formularios.ver':true,'formularios.formularios.editar':true,'formularios.formularios.crear':true}}} initialForm={original}/>);
