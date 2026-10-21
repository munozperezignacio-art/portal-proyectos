const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

function harness(native) {
  let slots=[],cursor=0,effects=[],timers=[],intervals=[];
  const react={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},
    useRef(initial){const index=cursor++;return slots[index]??(slots[index]={current:initial});},
    useCallback(fn){cursor++;return fn;},
    useEffect(fn,deps){const index=cursor++;const prior=slots[index];if(!prior||deps.some((x,i)=>x!==prior.deps[i])){effects.push(()=>{prior?.cleanup?.();slots[index]={deps,cleanup:fn()};});}},
  };
  const release={version:'1.0.9',build:14,sha256:'a'.repeat(64),apkUrl:'https://expo.dev/artifacts/eas/test.apk'};
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/useAppUpdates.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports={};
  const deps={react,'expo-application':{nativeApplicationVersion:'1.0.8',nativeBuildVersion:'13'},'expo-constants':{},'./nativeUpdater':{nativeUpdater:native},'react-native':{Platform:{OS:'android'},AppState:{addEventListener:()=>({remove(){}})}},'./appUpdates':{fetchAndroidRelease:async()=>release,isNewerRelease:(r,v)=>r.build>v.build,shouldCheckUpdate:()=>true}};
  vm.runInNewContext(code,{exports,Error,require:name=>{assert.ok(name in deps,name);return deps[name];},__DEV__:false,AbortController,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval(){}});
  const render=()=>{cursor=0;const result=exports.useAppUpdates();const pending=effects;effects=[];pending.forEach(fn=>fn());return result;};
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  return {render,flush,async init(){render();timers.shift()();await flush();render();await flush();return render();},async poll(){intervals.at(-1)();await flush();return render();}};
}

test('descarga interna, bloqueo de doble pulsación, progreso, cancelación y recuperación tras reinicio',async()=>{
  let starts=0,cancels=0,status={status:'idle',progress:0},finish;
  const native={status:async()=>status,start:()=>{starts++;return new Promise(resolve=>{finish=resolve;});},cancel:async()=>{cancels++;status={status:'idle',progress:0};},install:async()=>{throw new Error('No debería instalar todavía');}};
  const h=harness(native);let ui=await h.init();
  const first=ui.download();await ui.download();assert.equal(starts,1);finish();await first;
  ui=h.render();assert.equal(ui.transfer.status,'downloading');
  status={status:'downloading',progress:.45};ui=await h.poll();assert.equal(ui.transfer.progress,.45);
  await ui.cancel();ui=h.render();assert.equal(cancels,1);assert.equal(ui.transfer.status,'idle');
  status={status:'ready',progress:1};const resumed=harness(native);ui=await resumed.init();assert.equal(ui.transfer.status,'ready');
});

test('permiso e instalador se abren sin volver a descargar; error permite reintentar',async()=>{
  let result='permission',installs=0,starts=0;
  const native={status:async()=>({status:'ready',progress:1}),start:async()=>{starts++;},cancel:async()=>{},install:async()=>{installs++;if(result==='error')throw new Error('Instalador no disponible');return result;}};
  const h=harness(native);let ui=await h.init();await ui.download();ui=h.render();assert.match(ui.installMessage,/Autoriza/);
  result='installer';await ui.download();ui=h.render();assert.match(ui.installMessage,/Confirma/);
  result='error';await ui.download();ui=h.render();assert.match(ui.error,/Instalador no disponible/);assert.equal(ui.transfer.status,'ready');assert.equal(starts,0);assert.equal(installs,3);
});

test('no abre navegador ni descarga cuando falta soporte nativo o falla la verificación',async()=>{
  let h=harness(null),ui=await h.init();await ui.download();assert.match(h.render().error,/nueva APK/);
  const native={status:async()=>{throw new Error('Archivo alterado');},start:async()=>{},cancel:async()=>{},install:async()=>{throw new Error('No debe instalar');}};
  h=harness(native);ui=await h.init();assert.equal(ui.transfer.status,'idle');assert.match(ui.error,/Archivo alterado/);
});
