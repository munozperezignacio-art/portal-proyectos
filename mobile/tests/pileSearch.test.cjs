const test=require('node:test');
const assert=require('node:assert/strict');
test('Mobile pile search is exact by number, natural order and front based',async()=>{
 const {matchesPile,sortPiles}=await import('../src/lib/pileSearch.mjs');
 const piles=Array.from({length:290},(_,i)=>({numero:String(i+1),frente:'TORRE A',etapa:'General'})).sort((a,b)=>a.numero.localeCompare(b.numero));
 assert.deepEqual(sortPiles(piles).map(p=>Number(p.numero)),Array.from({length:290},(_,i)=>i+1));
 for(let i=1;i<=290;i++){assert.equal(piles.filter(p=>matchesPile(p,String(i))).length,1);assert.equal(piles.filter(p=>matchesPile(p,'Pila '+i)).length,1);}
 assert.equal(piles.filter(p=>matchesPile(p,'torre a')).length,290);
 assert.equal(piles.filter(p=>matchesPile(p,'General')).length,0);
});
