import test from 'node:test';
import assert from 'node:assert/strict';
import {projectName,renameWorkScope,migrateProjectStorage} from './projectProfile.js';
test('project name normalized; blank, reserved, commas and excessively long names rejected',()=>{
  assert.equal(projectName('  Edificio   Lonco  '),'Edificio Lonco');
  for(const value of ['',null,'Todas','TODOS','*','Lonco,Otra','a'.repeat(151)])assert.throws(()=>projectName(value));
});
test('only the renamed project changes in a scoped access list',()=>{
  assert.equal(renameWorkScope('Lonco,Otro Lonco, Sur','Lonco','Edificio Lonco'),'Edificio Lonco,Otro Lonco,Sur');
  assert.equal(renameWorkScope('todas','Lonco','Edificio Lonco'),'todas');
  assert.equal(renameWorkScope(null,'Lonco','Edificio Lonco'),null);
});
test('favorites and local project settings follow the new name without touching other works',()=>{
  const data=new Map([['obraxis_favorites','["Lonco","Sur"]'],['obraxis_custom_salaries_Lonco','{"a":2}'],['obraxis_asignaciones_periodos_Lonco','[1]'],['other','keep']]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  migrateProjectStorage(storage,'Lonco','Edificio Lonco');
  assert.equal(data.get('obraxis_favorites'),'["Edificio Lonco","Sur"]');
  assert.equal(data.get('obraxis_custom_salaries_Edificio Lonco'),'{"a":2}');
  assert.equal(data.get('obraxis_asignaciones_periodos_Edificio Lonco'),'[1]');
  assert.equal(data.has('obraxis_custom_salaries_Lonco'),false);
  assert.equal(data.get('other'),'keep');
  assert.doesNotThrow(()=>migrateProjectStorage({getItem:()=>{throw Error('Storage full');}},'A','B'));
});
