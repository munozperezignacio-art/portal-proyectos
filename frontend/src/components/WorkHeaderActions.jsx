import React,{useLayoutEffect,useState} from 'react';
import {createPortal} from 'react-dom';
export default function WorkHeaderActions({children,enabled=true}){
 const [slot,setSlot]=useState(null);
 useLayoutEffect(()=>{setSlot(enabled?document.getElementById('obra-module-actions'):null);},[enabled]);
 return slot?createPortal(children,slot):children;
}
