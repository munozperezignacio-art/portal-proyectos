// Read-only artifact verification. Does not publish or change the release receipt.
import fs from 'node:fs';import crypto from 'node:crypto';import JSZip from 'jszip';import assert from 'node:assert/strict';
const [receiptPath,apkPath,expectedBuild]=process.argv.slice(2);if(!expectedBuild)throw Error('receipt.json artifact.apk build');
const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8')),bytes=fs.readFileSync(apkPath),zip=await JSZip.loadAsync(bytes);
const xml=await zip.file('AndroidManifest.xml').async('nodebuffer');let strings=[],attributes={};
for(let pos=8;pos<xml.length;){
 const type=xml.readUInt16LE(pos),header=xml.readUInt16LE(pos+2),size=xml.readUInt32LE(pos+4);if(size<header||pos+size>xml.length)throw Error('Invalid Android manifest');
 if(type===1){
  const count=xml.readUInt32LE(pos+8),utf8=!!(xml.readUInt32LE(pos+16)&256),start=pos+xml.readUInt32LE(pos+20);
  const length8=offset=>xml[offset]&128?{value:((xml[offset]&127)<<8)|xml[offset+1],next:offset+2}:{value:xml[offset],next:offset+1};
  for(let i=0;i<count;i++){let offset=start+xml.readUInt32LE(pos+header+i*4);if(utf8){offset=length8(offset).next;const length=length8(offset);strings.push(xml.toString('utf8',length.next,length.next+length.value));}else{let length=xml.readUInt16LE(offset);offset+=2;if(length&32768){length=((length&32767)<<16)|xml.readUInt16LE(offset);offset+=2;}strings.push(xml.toString('utf16le',offset,offset+length*2));}}
 }
 if(type===0x102&&strings[xml.readUInt32LE(pos+20)]==='manifest'){
  const count=xml.readUInt16LE(pos+28),step=xml.readUInt16LE(pos+26),start=pos+16+xml.readUInt16LE(pos+24);
  for(let i=0;i<count;i++){const p=start+i*step,name=strings[xml.readUInt32LE(p+4)],raw=xml.readUInt32LE(p+8),kind=xml[p+15],value=xml.readUInt32LE(p+16);attributes[name]=raw!==0xffffffff?strings[raw]:kind===3?strings[value]:value;}
 }
 pos+=size;
}
assert.equal(attributes.package,'cl.obraxis.terreno');assert.equal(String(attributes.versionCode),String(expectedBuild));assert.equal(attributes.versionName,receipt.version);
const candidateNames=Object.keys(zip.files).filter(name=>/app\.config$|manifest\.json$|expo.*\.json$/.test(name));let release;
for(const name of candidateNames){try{const config=JSON.parse(await zip.file(name).async('string'));const candidate=config.extra?.release||config.extra?.expoClient?.extra?.release;if(candidate){release=candidate;break;}}catch{}}
assert.ok(release,'Embedded Expo release is required');assert.equal(release.commit,receipt.commit);assert.equal(release.sourceHash,receipt.sourceHash);
console.log(JSON.stringify({packageName:attributes.package,version:attributes.versionName,build:attributes.versionCode,commit:release.commit,sourceHash:release.sourceHash,apkSha256:crypto.createHash('sha256').update(bytes).digest('hex'),verifiedEmbeddedRelease:true}));
