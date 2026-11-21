import React from 'react';
import {createRoot} from 'react-dom/client';
import LoncoDownload from '../../src/components/LoncoDownload';
import {supabase} from '../../src/supabaseClient';
import '../../src/index.css';
const obras=[{id:1,nombre:'CAM Coquimbo',empresa:'EMINSG',centro_gestion_id:11},{id:2,nombre:'Lonco',empresa:'EMINSG',centro_gestion_id:22}];
const workers=[{id:1,nombre:'Personal CAM',rut:'1-9',empresa:'EMINSG',estado:'Activo',obra_nombre:'CAM Coquimbo'},{id:2,nombre:'Personal Lonco',rut:'2-7',empresa:'EMINSG',estado:'Activo',obra_nombre:'Lonco'},{id:3,nombre:'Persona dada de baja',rut:'3-5',empresa:'EMINSG',estado:'Inactivo',obra_nombre:'CAM Coquimbo'},{id:4,nombre:'Sin relación',rut:'4-3',empresa:'EMINSG',estado:'Activo'}];
supabase.from=table=>{const q={select(){return q;},eq(){return q;},gte(){return q;},lte(){return q;},order(){return q;},async range(){return {data:table==='maestro_personal'?workers:[],error:null};}};return q;};
createRoot(document.getElementById('root')).render(<LoncoDownload empresa="EMINSG" obras={obras} workers={workers} period="2026-11"/>);
