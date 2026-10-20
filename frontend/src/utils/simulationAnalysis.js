import {simulateProject} from './projectSimulator.js';

// Sensibilidad determinista: modifica supuestos, no expresa probabilidades ni intervalos estadísticos.
export function simulationAnalysis(input,{variation=15,costBudget=null}={}){
  const delta=Number(variation);
  if(!Number.isFinite(delta)||delta<0||delta>50)throw Error('La variación debe estar entre 0 y 50%.');
  const scenarios=[['Menor rendimiento',1-delta/100],['Escenario base',1],['Mayor rendimiento',1+delta/100]].map(([name,factor])=>{
    const parts=input.parts.map(p=>({...p,pace:Number(p.pace)*factor,overrides:Object.fromEntries(Object.entries(p.overrides||{}).map(([date,value])=>[date,value===''||value==null?value:Number(value)*factor]))}));
    const result=simulateProject({...input,parts});
    return {name,factor,result,variance:result.totalAtFinish!=null&&Number(costBudget)>0?result.totalAtFinish-Number(costBudget):null};
  });
  const base=scenarios[1].result;
  const drivers=base.parts.filter(p=>p.initialRemaining>0).sort((a,b)=>{
    if(!a.finish||!b.finish)return Number(Boolean(a.finish))-Number(Boolean(b.finish));
    return b.finish.localeCompare(a.finish);
  }).map(p=>({...p,increase:p.requiredPace!=null&&p.pace>0?Math.max(0,(p.requiredPace/p.pace-1)*100):null}));
  return {scenarios,drivers,base};
}
