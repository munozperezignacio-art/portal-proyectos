// Shared by the public endpoint and its local tests. Never receives a personnel list.
export function normalizeRut(value) {
 const raw=String(value??'').trim().toUpperCase().replace(/[.\s-]/g,'');
 if(!/^[0-9]{7,8}[0-9K]$/.test(raw))return null;
 const digits=raw.slice(0,-1);let sum=0,factor=2;
 for(let i=digits.length-1;i>=0;i--){sum+=Number(digits[i])*factor;factor=factor===7?2:factor+1;}
 const check=11-sum%11,expected=check===11?'0':check===10?'K':String(check);
 return raw.at(-1)===expected?raw:null;
}
const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function checklistCandidates(equipment,forms) {
 const name=norm(equipment.tipo);
 // Accessories containing a machine name are not machines.
 if(/^(broca|extension|buzon|cuello|reductor|pizon|balde|viga)\b/.test(name))return [];
 let pattern;
 if(name.includes('lodrill'))pattern=/excavadora lodrill/;
 else if(name.includes('excavadora')&&/impact|mast/.test(name))pattern=/excavadora impact/;
 else if(name==='excavadora')pattern=/^lista de verificacion excavadora$/;
 else if(name==='compresor')pattern=/compresor de aire/;
 else return [];
 return forms.filter(f=>f.empresa===equipment.empresa&&pattern.test(norm(f.titulo))).map(f=>f.id);
}
export const identityFields=[
 {id:'qr_equipo',type:'text',label:'Equipo',required:true,systemRequired:true,autoFilled:true},
 {id:'qr_rut',type:'text',label:'RUT de quien registra',required:true,systemRequired:true,autoFilled:true},
 {id:'qr_nombre',type:'text',label:'Nombre de quien registra',required:true,systemRequired:true,autoFilled:true},
 {id:'qr_cargo',type:'text',label:'Cargo',required:true,systemRequired:true,autoFilled:true},
 {id:'qr_fecha',type:'date',label:'Fecha',required:true,systemRequired:true}
];
export function withEquipmentFields(fields,{meter=false}={}) {
 const protectedFields=[...identityFields,...(meter?[{id:'qr_horometro',type:'number',label:'Horómetro / lectura',required:true,systemRequired:true}]:[])];
 return [...protectedFields,...fields.filter(f=>!protectedFields.some(p=>p.id===f.id))];
}
export function assertProtectedEquipmentFields(before,after) {
 for(const original of before.filter(f=>f.systemRequired)){
  const field=after.find(f=>f.id===original.id);
  if(!field||field.type!==original.type||field.required!==true||field.systemRequired!==true||field.condition||field.showIf||field.showWhen||field.hidden||(original.autoFilled&&!field.autoFilled))throw Error('No se puede eliminar, ocultar ni hacer opcional el campo protegido: '+original.label);
 }
}
