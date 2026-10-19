const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const tests = fs.readdirSync(path.join(__dirname, '../tests')).filter(name => name.endsWith('.test.cjs')).sort().map(name => path.join(__dirname, '../tests', name));
if (!tests.length) throw new Error('No se encontraron pruebas del móvil.');
const result = spawnSync(process.execPath, ['--test', ...tests], { stdio:'inherit', windowsHide:true });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
