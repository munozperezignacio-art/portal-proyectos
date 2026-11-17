// Read-only deployment check; no credentials, imports or assignment writes.
import assert from 'node:assert/strict';
const base='https://www.obraxis.cl';
const html=await(await fetch(base)).text();
let found=false;
for(const [,path] of html.matchAll(/src="([^"]+\.js)"/g)){
 const js=await(await fetch(new URL(path,base))).text();
 for(const [chunk] of js.matchAll(/(?:assets\/)?Maquinaria-[a-zA-Z0-9_-]+\.js/g)){
  const code=await(await fetch(new URL('/'+(chunk.startsWith('assets/')?chunk:'assets/'+chunk),base))).text();
  if(code.includes('Estación de servicio')&&code.includes('station_commune'))found=true;
 }
}
assert.ok(found,'Production must deliver station header and commune');
console.log('PASS production station assets');
