import React from 'react';import {createRoot} from 'react-dom/client';import {supabase} from '../../src/supabaseClient';import ProgressActivities from '../../src/components/ProgressActivities';import '../../src/index.css';
let state=JSON.parse(localStorage.getItem('activity-test')||'null')||{revision:0,entries:[],can_write:true,catalog:[],parts:[{id:10,partida:'Pilas de grava'}]};
supabase.rpc=async(name,args)=>{if(args.p_entries){state={...state,entries:args.p_entries,revision:state.revision+1,catalog:args.p_entries.filter(r=>!r.partida_id).map(r=>({nombre:r.actividad}))};localStorage.setItem('activity-test',JSON.stringify(state));}return {data:state,error:null};};
window.open=url=>{window.shared=url;};
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-4xl p-4"><ProgressActivities work={{id:1,nombre:'CAM Coquimbo'}} date="2026-11-20" reports={[{fecha:'2026-11-20',partida:'Pilas de grava',cantidad:18,unidad:'UND'}]}/></main>);
