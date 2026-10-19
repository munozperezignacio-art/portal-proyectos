const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ts=require('typescript');
function releaseFunctions(){
  const module={exports:{}};
  const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/appUpdates.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('exports','module',compiled)(module.exports,module);
  return module.exports;
}
function publicRelease(receipt,apkBytes,notes){
  const {parseAndroidRelease}=releaseFunctions();
  if(receipt.status!=='FINISHED'||receipt.verifiedEmbeddedRelease!==true||!receipt.builds?.some(b=>b.status==='FINISHED'&&b.platform==='ANDROID'))throw new Error('Solo se publican APK terminadas y verificadas contra su registro interno.');
  const sha256=crypto.createHash('sha256').update(apkBytes).digest('hex');
  if(sha256!==receipt.apkSha256)throw new Error('El APK no coincide con el archivo verificado.');
  if(!notes.length)throw new Error('Indica al menos una novedad para las personas que actualizan.');
  return parseAndroidRelease({schema:1,platform:'android',packageName:'cl.obraxis.terreno',version:receipt.version,build:Number(receipt.appBuildVersion),apkUrl:receipt.artifactUrl,sha256,commit:receipt.commit,sourceHash:receipt.sourceHash,publishedAt:new Date().toISOString(),notes});
}
if(require.main===module){
  try{
    const [receiptPath,apkPath,...notes]=process.argv.slice(2);
    if(!receiptPath||!apkPath)throw new Error('Uso: npm run mobile:apk:publish -- registro.json archivo.apk "Novedad"');
    const release=publicRelease(JSON.parse(fs.readFileSync(receiptPath,'utf8').replace(/^\uFEFF/,'')),fs.readFileSync(apkPath),notes);
    const output=path.resolve(__dirname,'../../releases/android.json');
    if(fs.existsSync(output)){
      const current=releaseFunctions().parseAndroidRelease(JSON.parse(fs.readFileSync(output,'utf8')));
      if(release.build<=current.build)throw new Error('No se permite reemplazar o retroceder la versión publicada.');
    }
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(release,null,2)+'\n');
    console.log(`Catálogo preparado: ${output}. Revisa y publica este archivo en main para anunciar la actualización.`);
  }catch(error){console.error(`PUBLICACIÓN BLOQUEADA: ${error.message}`);process.exitCode=1;}
}
module.exports={publicRelease};
