import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vite = resolve(root, 'node_modules/vite/bin/vite.js');
const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', '4173'], {
  cwd: root,
  stdio: 'ignore',
  windowsHide: true,
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4173');
      if (response.ok) return;
    } catch {}
    await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
  }
  throw new Error('Vite no inicio en el puerto 4173');
};

let exitCode = 1;
try {
  await waitForServer();
  exitCode = await new Promise((resolveExit, reject) => {
    const test = spawn(process.execPath, [playwright, 'test'], { cwd: root, stdio: 'inherit', windowsHide: true });
    test.once('error', reject);
    test.once('exit', code => resolveExit(code ?? 1));
  });
} finally {
  server.kill();
}

process.exitCode = exitCode;
