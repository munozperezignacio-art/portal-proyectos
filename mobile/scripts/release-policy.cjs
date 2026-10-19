const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const manifestName = 'release-manifest.json';
const hash = file => {
  let content = fs.readFileSync(file);
  if (path.basename(file) === 'app.json') {
    const config = JSON.parse(content.toString('utf8'));
    // EAS administra estos contadores de forma remota; el resto del archivo es inmutable.
    if (config.expo?.android) delete config.expo.android.versionCode;
    if (config.expo?.ios) delete config.expo.ios.buildNumber;
    content = JSON.stringify(config);
  }
  return crypto.createHash('sha256').update(content).digest('hex');
};
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim();
const splitZero = value => value.split('\0').filter(Boolean);
const runtimeFile = file => !/^(tests\/|\.vscode\/|\.claude\/|README\.md$|\.gitignore$|\.env)/.test(file);

function checkSource(mobileRoot, env = process.env) {
  if (env.EAS_NO_VCS || env.EAS_PROJECT_ROOT) throw new Error('No se permiten variables que cambien el origen de la compilación. Ejecuta npm run mobile:apk desde el proyecto original.');
  const repo = git(mobileRoot, 'rev-parse', '--show-toplevel');
  if (fs.realpathSync(path.join(repo, 'mobile')) !== fs.realpathSync(mobileRoot)) throw new Error('El móvil debe pertenecer al proyecto original; no compiles desde una copia parcial.');
  if (git(repo, 'branch', '--show-current') !== 'main') throw new Error('La APK debe salir de main, con todas las mejoras integradas.');
  const pending = git(repo, 'status', '--porcelain=v1', '-z', '--untracked-files=all', '--', 'mobile');
  if (pending) throw new Error(`Hay cambios del móvil sin guardar en la versión. Inclúyelos antes de compilar:\n${splitZero(pending).join('\n')}`);
  const ignored = git(repo, 'ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', 'mobile/src', 'mobile/assets', 'mobile/scripts');
  if (ignored) throw new Error(`Hay archivos de la app ignorados por Git que quedarían fuera:\n${splitZero(ignored).join('\n')}`);
  const commit = git(repo, 'rev-parse', 'HEAD');
  if (commit !== git(repo, 'rev-parse', 'origin/main')) throw new Error('La versión local no coincide con origin/main. Integra y publica todas las mejoras antes de compilar.');
  return { repo, commit, version: JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8')).expo.version };
}

function createManifest(root, commit, files) {
  const inventory = files.filter(runtimeFile).sort().map(file => ({ path: file, sha256: hash(path.join(root, file)) }));
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
  const manifest = { schema: 1, commit, version: JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.version, createdAt: new Date().toISOString(), sourceHash, files: inventory };
  fs.writeFileSync(path.join(root, manifestName), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

function verifyManifest(root) {
  const manifestPath = path.join(root, manifestName);
  if (!fs.existsSync(manifestPath)) throw new Error('Falta el registro de versión. Genera el instalador con npm run mobile:apk; no uses eas build directamente.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema !== 1 || !/^[a-f0-9]{40}$/.test(manifest.commit) || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Registro de versión inválido.');
  const unique = new Set();
  for (const entry of manifest.files) {
    if (!entry.path || entry.path.includes('\\') || entry.path.split('/').includes('..') || path.isAbsolute(entry.path) || unique.has(entry.path)) throw new Error('Ruta inválida o duplicada en el registro.');
    unique.add(entry.path);
    const file = path.join(root, entry.path);
    if (!fs.existsSync(file) || hash(file) !== entry.sha256) throw new Error(`Archivo ausente o distinto de la versión aprobada: ${entry.path}`);
  }
  for (const required of ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'eas.json', '.easignore', 'scripts/verify-release.cjs', 'scripts/release-policy.cjs']) {
    if (!unique.has(required)) throw new Error(`Falta un archivo obligatorio en el registro: ${required}`);
  }
  const digest = crypto.createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex');
  if (digest !== manifest.sourceHash) throw new Error('El inventario de la versión cambió.');
  if (JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.version !== manifest.version) throw new Error('La versión de la app no coincide con el registro.');
  return manifest;
}

module.exports = { checkSource, createManifest, verifyManifest, git, splitZero, manifestName };
