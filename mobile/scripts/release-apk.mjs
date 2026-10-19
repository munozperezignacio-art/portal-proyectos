import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import policy from './release-policy.cjs';

const mobile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
function npm(args, cwd = mobile, capture = false, env = process.env) {
  if (!npmCli) throw new Error('Usa npm run mobile:apk desde la raíz del proyecto.');
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd, env, windowsHide: true, encoding: 'utf8', stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit', maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Falló la verificación: npm ${args.join(' ')}`);
  return result.stdout;
}

try {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--check','--inspect'].includes(arg)) || args.length > 1) throw new Error('Opciones admitidas: --check o --inspect (sin generar APK).');
  if (!args.includes('--check')) policy.git(mobile, 'fetch', 'origin', 'main');
  const source = policy.checkSource(mobile);
  npm(['run', 'typecheck']);
  npm(['test']);
  const checked = policy.checkSource(mobile);
  if (checked.commit !== source.commit) throw new Error('La versión cambió durante las verificaciones. Vuelve a ejecutar el proceso.');
  console.log(`Lista para compilar: ${source.version} · ${source.commit}`);
  if (!args.includes('--check')) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'obraxis-apk-'));
    const archive = path.join(directory, 'source.tar');
    const snapshot = path.join(directory, 'mobile');
    fs.mkdirSync(snapshot);
    policy.git(source.repo, 'archive', '--format=tar', `--output=${archive}`, `${source.commit}:mobile`);
    execFileSync('tar', ['-xf', archive, '-C', snapshot], { windowsHide: true });
    const files = policy.splitZero(policy.git(source.repo, 'ls-tree', '-r', '--name-only', '-z', `${source.commit}:mobile`));
    const manifest = policy.createManifest(snapshot, source.commit, files);
    policy.verifyManifest(snapshot);
    fs.symlinkSync(path.join(mobile, 'node_modules'), path.join(snapshot, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`Se enviarán ${manifest.files.length} archivos. Huella: ${manifest.sourceHash}`);
    const buildEnv = { ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: snapshot };
    if (args.includes('--inspect')) {
      const inspected = path.join(directory, 'archive');
      npm(['exec','--yes','--package=eas-cli@25.2.0','--','eas','build:inspect','--platform','android','--stage','archive','--output',inspected,'--profile','preview'],snapshot,false,buildEnv);
      const locate = folder => {
        if (fs.existsSync(path.join(folder, policy.manifestName))) return folder;
        for (const item of fs.readdirSync(folder,{withFileTypes:true})) {
          if (item.isDirectory() && item.name !== 'node_modules') { const found=locate(path.join(folder,item.name)); if (found) return found; }
        }
        return null;
      };
      const archiveRoot = locate(inspected);
      if (!archiveRoot) throw new Error('El archivo de envío no incluye el registro obligatorio.');
      policy.verifyManifest(archiveRoot);
      console.log(`Archivo de envío verificado sin generar APK: ${inspected}`);
      process.exit(0);
    }
    const output = npm(['exec', '--yes', '--package=eas-cli@25.2.0', '--', 'eas', 'build', '--platform', 'android', '--profile', 'preview', '--non-interactive', '--no-wait', '--json'], snapshot, true, buildEnv);
    const builds = JSON.parse(output);
    const records = Array.isArray(builds) ? builds : [builds];
    const receipt = { ...manifest, builds: records.map(build => ({ id: build.id, status: build.status, platform: build.platform })) };
    const receipts = path.join(source.repo, 'entregables', 'apk', 'registros');
    fs.mkdirSync(receipts, { recursive: true });
    const filename = `${manifest.version}-${source.commit.slice(0, 8)}-${Date.now()}.json`;
    fs.writeFileSync(path.join(receipts, filename), JSON.stringify(receipt, null, 2) + '\n');
    for (const build of records) console.log(`Compilación enviada: https://expo.dev/accounts/obraxis/projects/obraxis-terreno/builds/${build.id}`);
    console.log(`Registro de la versión: ${path.join(receipts, filename)}`);
  }
} catch (error) {
  console.error(`APK BLOQUEADA: ${error.message}`);
  process.exitCode = 1;
}
