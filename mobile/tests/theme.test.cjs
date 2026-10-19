const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
function load(file){const m={exports:{}};new Function('exports','module',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,m);return m.exports;}
const p=load('themePreference.ts');
(async()=>{for(const bad of [null,undefined,'invalid',{},''])assert.equal(p.parseThemePreference(bad),'automatic');
for(const pref of ['light','dark'])for(const sys of ['light','dark',null])assert.equal(p.resolveThemeMode(pref,sys),pref);
assert.equal(p.resolveThemeMode('automatic','dark'),'dark');assert.equal(p.resolveThemeMode('automatic',null),'light');
const values=new Map();const storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>{values.set(k,v)}};
await p.saveThemePreference(storage,'company:1','dark');assert.equal(await p.loadThemePreference(storage,'company:1'),'dark');assert.equal(await p.loadThemePreference(storage,'company:2'),'automatic');
await assert.rejects(p.saveThemePreference({setItem:async()=>{throw Error('full')}},'company:1','light'));
const {lightColors,darkColors}=load('theme.ts');
const lum=h=>{const c=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722};
for(const colors of [lightColors,darkColors])for(const [fg,bg] of [['ink','surface'],['muted','surface'],['onPrimary','primary'],['onPrimary','danger'],['blue','blueSoft'],['green','greenSoft'],['red','redSoft'],['amber','amberSoft']]){const a=lum(colors[fg]),b=lum(colors[bg]);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,fg+'/'+bg);}
console.log('Passed theme preference, per-user persistence, save failures, automatic resolution and text contrast.');
})().catch(e=>{console.error(e);process.exitCode=1});
