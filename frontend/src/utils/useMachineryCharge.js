import React,{useEffect,useRef,useState} from 'react';
import MachineryChargeDialog from '../components/MachineryChargeDialog';
import {machineryChargeConflict} from './machineryCharge';
export function useMachineryCharge(){
  const [conflict,setConflict]=useState(null),resolve=useRef(null),saving=useRef(false);
  useEffect(()=>()=>{resolve.current?.(null);},[]);
  const choose=choice=>{setConflict(null);resolve.current?.(choice);resolve.current=null;};
  const save=async insert=>{
    if(saving.current)return null;
    saving.current=true;
    try{
      let result=await insert(null);
      for(let attempt=0;attempt<3;attempt++){
        const issue=machineryChargeConflict(result.error);
        if(!issue)return result;
        const choice=await new Promise(done=>{resolve.current=done;setConflict(issue);});
        if(!choice)return null;
        result=await insert(choice);
      }
      return result;
    }finally{saving.current=false;}
  };
  return {save,dialog:conflict?React.createElement(MachineryChargeDialog,{conflict,onChoose:choose,onCancel:()=>choose(null)}):null};
}
