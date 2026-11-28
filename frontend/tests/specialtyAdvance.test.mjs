import test from 'node:test';
import assert from 'node:assert/strict';
import {configuredAdvanceParts,matchesPile} from '../src/utils/specialtyAdvance.js';
test('only configured parts with catalogue are operational; Quality can configure empty catalogue',()=>{
 const parts=[{id:1},{id:2},{id:3,es_titulo:true}],settings=[{partida_id:1},{partida_id:3}],elements=[{partida_id:1},{partida_id:2},{partida_id:3}];
 assert.deepEqual(configuredAdvanceParts(parts,settings,elements),[{id:1}]);
 assert.deepEqual(configuredAdvanceParts(parts,[],elements),[]);
 assert.deepEqual(configuredAdvanceParts(parts,settings,[]),[]);
 assert.deepEqual(configuredAdvanceParts(parts,settings),[{id:1}]);
});
test('search handles number and front, accents and whitespace',()=>{
 const pile={numero:'13',etapa:'Etápa Norte',frente:'TORRE A'};
 for(const q of ['13','pila 13','  torre  a ','TORRE A 13'])assert.equal(matchesPile(pile,q),true,q);
 assert.equal(matchesPile(pile,'torre b'),false);assert.equal(matchesPile(null,'13'),false);
});
