const path = require('node:path');
const { verifyManifest } = require('./release-policy.cjs');
try {
  const release = verifyManifest(path.resolve(__dirname, '..'));
  console.log(`Versión íntegra: ${release.version} · ${release.commit.slice(0, 8)} · ${release.files.length} archivos verificados.`);
} catch (error) {
  console.error(`COMPILACIÓN BLOQUEADA: ${error.message}`);
  process.exitCode = 1;
}
