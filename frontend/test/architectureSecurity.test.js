import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(frontendRoot, 'src');
const functionsRoot = resolve(frontendRoot, '..', 'supabase', 'functions');

function filesUnder(directory, predicate = () => true) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path, predicate) : predicate(path) ? [path] : [];
  });
}

const sourceFiles = filesUnder(sourceRoot, path => /\.(?:js|jsx)$/.test(path));

test('el frontend no contiene secretos reservados para Supabase', () => {
  const forbidden = ['SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'];
  const findings = [];
  for (const path of sourceFiles) {
    const source = readFileSync(path, 'utf8');
    for (const secret of forbidden) if (source.includes(secret)) findings.push(`${relative(sourceRoot, path)}: ${secret}`);
  }
  assert.deepEqual(findings, []);
});

test('los portales públicos no escriben directamente en tablas', () => {
  const publicFiles = sourceFiles.filter(path => /(?:^|[\\/])Public[^\\/]*\.jsx$/.test(path));
  const findings = publicFiles
    .filter(path => /supabase\s*\.\s*from\s*\(/.test(readFileSync(path, 'utf8')))
    .map(path => relative(sourceRoot, path));
  assert.deepEqual(findings, []);
});

test('cada Edge Function invocada literalmente por el frontend está versionada', () => {
  const invoked = new Set();
  const pattern = /functions\s*\.\s*invoke\s*\(\s*['"]([^'"]+)['"]/g;
  for (const path of sourceFiles) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(pattern)) invoked.add(match[1]);
  }
  const missing = [...invoked].filter(name => !existsSync(join(functionsRoot, name, 'index.ts'))).sort();
  assert.deepEqual(missing, []);
  assert.ok(invoked.size >= 10, 'La prueba debe cubrir un conjunto significativo de funciones');
});

test('las bibliotecas documentales pesadas se cargan solo mediante el adaptador compartido', () => {
  const heavyPackages = ['xlsx', 'jspdf', 'mammoth/mammoth.browser'];
  const findings = [];
  for (const path of sourceFiles) {
    if (relative(sourceRoot, path) === join('services', 'documentEngines.js')) continue;
    const source = readFileSync(path, 'utf8');
    for (const packageName of heavyPackages) {
      const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const staticImport = new RegExp(`^\\s*import\\s+.+?\\s+from\\s+['"]${escapedName}['"]`, 'm');
      const dynamicImport = new RegExp(`import\\(\\s*['"]${escapedName}['"]\\s*\\)`);
      if (staticImport.test(source) || dynamicImport.test(source)) findings.push(`${relative(sourceRoot, path)}: ${packageName}`);
    }
  }
  assert.deepEqual(findings, []);
});

test('la versión activa de Node cumple el contrato del proyecto', () => {
  const [major, minor] = process.versions.node.split('.').map(Number);
  assert.ok(major > 22 || (major === 22 && minor >= 12), `Node ${process.versions.node} no cumple >=22.12.0`);
});
