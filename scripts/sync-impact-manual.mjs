// El contenido y las fotos del móvil son la fuente compartida para ambas aplicaciones.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'mobile/assets/manuales/impact');
const manual = JSON.parse(await readFile(resolve(root, 'mobile/src/data/impactManual.json'), 'utf8'));
for (const destination of ['frontend/src/data', 'mobile/src/data']) {
  await mkdir(resolve(root, destination), { recursive: true });
  await writeFile(resolve(root, destination, 'impactManual.json'), JSON.stringify(manual, null, 2) + '\n');
}
for (const destination of ['frontend/src/assets/manuales/impact']) {
  await mkdir(resolve(root, destination), { recursive: true });
  for (const step of manual.pasos.filter(step => step.imagen)) {
    const name = step.imagen.split('/').pop();
    await copyFile(resolve(source, name), resolve(root, destination, name));
  }
}
const imports = manual.pasos.filter(step => step.imagen).map(step => {
  const name = step.imagen.split('/').pop();
  return `import photo${step.paso} from '../assets/manuales/impact/${name}';`;
}).join('\n');
const webMap = manual.pasos.filter(step => step.imagen).map(step => `  ${step.paso}: photo${step.paso},`).join('\n');
await writeFile(resolve(root, 'frontend/src/data/impactImages.js'), `${imports}\n\nexport const impactImages = {\n${webMap}\n};\n`);
const nativeMap = manual.pasos.filter(step => step.imagen).map(step => `  ${step.paso}: require('../../assets/manuales/impact/${step.imagen.split('/').pop()}'),`).join('\n');
await writeFile(resolve(root, 'mobile/src/data/impactImages.ts'), `import type { ImageSourcePropType } from 'react-native';\n\nexport const impactImages: Record<number, ImageSourcePropType> = {\n${nativeMap}\n};\n`);
console.log(`Manual empaquetado: ${manual.pasos.length} pasos, ${Object.keys(manual.pasos.filter(s => s.imagen)).length} fotografías por aplicación.`);
