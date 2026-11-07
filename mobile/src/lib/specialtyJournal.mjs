// Storage and transport are injected so web and native use the same recovery logic.
export function createJournalStore({storage,send,uuid,scope}) {
 const key=`obraxis:specialty:v1:${scope}`;
 let lock=Promise.resolve();
 let syncing=null;
 const serial=fn=>{const next=lock.then(fn,fn);lock=next.catch(()=>{});return next;};
 const read=async()=>JSON.parse(await storage.getItem(key)||'{}');
 const write=value=>storage.setItem(key,JSON.stringify(value));
 return {
  read:()=>serial(read),
  edit:session=>serial(async()=>{
   const state=await read();
   if(state.draft?.closeRequested)throw new Error('El cierre está pendiente de sincronización. No se puede modificar.');
   await write({...state,draft:{...session,localRevision:(state.draft?.localRevision||0)+1}});
  }),
  close:()=>serial(async()=>{const state=await read();if(!state.draft)throw new Error('No hay jornada');state.draft.closeRequested=true;state.draft.localRevision++;await write(state);}),
  // Keep the exact request until its response is acknowledged. A transport timeout
  // must replay the same request_id, not generate a new report.
  sync:()=>{
   if(syncing)return syncing;
   syncing=(async()=>{
    const flight=await serial(async()=>{
     const state=await read();
     if(!state.draft||(!state.inFlight&&state.ackRevision===state.draft.localRevision))return null;
     if(!state.inFlight){
      state.inFlight={action:state.draft.closeRequested?'close':'save',localRevision:state.draft.localRevision,
       data:{...state.draft,revision:state.serverRevision??state.draft.revision??0,request_id:uuid()}};
      await write(state);
     }
     return state.inFlight;
    });
    if(!flight)return null;
    let response;
    try { response=await send(flight.action,flight.data); }
    catch(error){
     // A PostgreSQL validation rejection rolled back the transaction. Unlike a
     // timeout, it is safe to unlock the local draft so the user can correct it.
     if(['P0001','23505','23514','22P02','22007','22003'].includes(error?.code))await serial(async()=>{const state=await read();state.lastRejected={request:state.inFlight,message:error.message};delete state.inFlight;if(state.draft)state.draft.closeRequested=false;await write(state);});
     throw error;
    }
    await serial(async()=>{
     const state=await read();
     state.serverRevision=response.revision;state.ackRevision=flight.localRevision;
     state.draft={...state.draft,revision:response.revision};delete state.inFlight;
     if(flight.action==='close'){state.lastClosed=response;delete state.draft;delete state.serverRevision;delete state.ackRevision;}
     await write(state);
    });
    return response;
   })().finally(()=>{syncing=null;});
   return syncing;
  }
 };
}

export function pileDiagram(elements, selectedIds=[], completedIds=[]) {
 const usable=elements.filter(e=>Number.isFinite(Number(e.este))&&Number.isFinite(Number(e.norte)));
 if(!usable.length)return [];
 const xs=usable.map(e=>Number(e.este)),ys=usable.map(e=>Number(e.norte));
 const minX=Math.min(...xs),maxY=Math.max(...ys);
 const scale=Math.min(560/Math.max(1,Math.max(...xs)-minX),360/Math.max(1,maxY-Math.min(...ys)));
 return usable.map(e=>({...e,x:20+(Number(e.este)-minX)*scale,y:20+(maxY-Number(e.norte))*scale,
  status:selectedIds.includes(e.id)?'day':completedIds.includes(e.id)||e.sesion_id?'done':'pending'}));
}
