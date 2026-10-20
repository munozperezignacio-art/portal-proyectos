export function machineryChargeConflict(error){
  if(error?.message!=='MAQUINARIA_DESTINO_REQUERIDO')return null;
  try{
    const data=JSON.parse(error.details);
    return Array.isArray(data.obras)&&data.obras.length>1?data:null;
  }catch{return null;}
}
