const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { checkSource, createManifest, verifyManifest } = require('../scripts/release-policy.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'obraxis-release-test-'));
  t.after(() => {
    if (!root.startsWith(path.join(os.tmpdir(), 'obraxis-release-test-'))) throw new Error('Directorio temporal inesperado');
    fs.rmSync(root, { recursive:true, force:true });
  });
  const mobile = path.join(root, 'mobile'); fs.mkdirSync(mobile);
  const write = (file, value) => { const target=path.join(mobile,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value); };
  const git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
  git('init','-b','main'); git('config','user.email','release-test@example.invalid'); git('config','user.name','Release test');
  write('app.json',JSON.stringify({expo:{version:'1.0.4',android:{package:'test.app'}}}));
  write('.gitignore','release-manifest.json\nassets/ignored.png\n');
  for (const name of ['package.json','package-lock.json','app.config.js','eas.json','.easignore','scripts/verify-release.cjs','scripts/release-policy.cjs','src/feature.ts']) write(name,'test');
  git('add','.');git('commit','-m','initial');git('update-ref','refs/remotes/origin/main','HEAD');
  const commit=git('rev-parse','HEAD');
  const files=git('ls-tree','-r','--name-only','HEAD:mobile').split('\n');
  return {root,mobile,write,git,commit,files};
}

test('permite una versión completa y rechaza cambios pendientes, incluso archivos nuevos', t => {
  const f=fixture(t);
  assert.equal(checkSource(f.mobile,{}).commit,f.commit);
  f.write('src/new-feature.ts','nueva mejora');
  assert.throws(()=>checkSource(f.mobile,{}),/sin guardar/);
  fs.unlinkSync(path.join(f.mobile,'src/new-feature.ts'));
  f.write('src/feature.ts','cambio sin commit');
  assert.throws(()=>checkSource(f.mobile,{}),/sin guardar/);
});
test('rechaza copias sin Git, variables para cambiar el origen y mejoras ignoradas', t => {
  const f=fixture(t);
  assert.throws(()=>checkSource(f.mobile,{EAS_NO_VCS:'1'}),/No se permiten/);
  assert.throws(()=>checkSource(f.mobile,{EAS_PROJECT_ROOT:f.mobile}),/No se permiten/);
  const partial=path.join(f.root,'copia');fs.mkdirSync(partial);
  assert.throws(()=>checkSource(partial,{}),/proyecto original/);
  f.write('assets/ignored.png','imagen pendiente');
  assert.throws(()=>checkSource(f.mobile,{}),/ignorados/);
});
test('un inventario incompleto o manipulado no se acepta', t => {
  const f=fixture(t);
  createManifest(f.mobile,f.commit,f.files.filter(file=>file!=='package-lock.json'));
  assert.throws(()=>verifyManifest(f.mobile),/obligatorio/);
  const manifest=createManifest(f.mobile,f.commit,f.files);
  manifest.sourceHash='0'.repeat(64);
  fs.writeFileSync(path.join(f.mobile,'release-manifest.json'),JSON.stringify(manifest));
  assert.throws(()=>verifyManifest(f.mobile),/inventario/);
});
test('rechaza una rama distinta y versiones que no coinciden con main publicado', t => {
  const f=fixture(t);
  f.git('checkout','-b','otro');
  assert.throws(()=>checkSource(f.mobile,{}),/main/);
  f.git('checkout','main');f.write('src/feature.ts','nuevo');f.git('add','.');f.git('commit','-m','not pushed');
  assert.throws(()=>checkSource(f.mobile,{}),/origin\/main/);
});
test('Expo rechaza archivos faltantes, alterados o un registro ausente', t => {
  const f=fixture(t);
  assert.throws(()=>verifyManifest(f.mobile),/Falta el registro/);
  createManifest(f.mobile,f.commit,f.files);
  assert.equal(verifyManifest(f.mobile).commit,f.commit);
  f.write('src/feature.ts','archivo alterado');
  assert.throws(()=>verifyManifest(f.mobile),/ausente o distinto/);
  f.write('src/feature.ts','test');fs.unlinkSync(path.join(f.mobile,'src/feature.ts'));
  assert.throws(()=>verifyManifest(f.mobile),/ausente o distinto/);
});
test('el contador remoto no invalida el contenido y la versión visible sí se verifica', t => {
  const f=fixture(t);createManifest(f.mobile,f.commit,f.files);
  f.write('app.json',JSON.stringify({expo:{version:'1.0.4',android:{package:'test.app',versionCode:10}}}));
  assert.equal(verifyManifest(f.mobile).version,'1.0.4');
  f.write('app.json',JSON.stringify({expo:{version:'1.0.5',android:{package:'test.app',versionCode:10}}}));
  assert.throws(()=>verifyManifest(f.mobile),/ausente o distinto/);
});
